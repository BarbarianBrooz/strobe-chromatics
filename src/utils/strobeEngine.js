// Pure-JS GIF encoder — no external dependencies needed

export const DEFAULT_CONFIG = {
  base_strobe_length_s: 0.2,
  strobe_increment_s: 0.005,
  direction: 'red_to_violet',
  palette_size: 256,
  quantization_algorithm: 'median_cut',
  non_spectral_color_policy: 'nearest_edge',
  phase_ratios: { start: 0.2, persist: 0.6, end: 0.2 },
  fps: 30,
  duration_mode: 'fixed',
  max_duration_s: 3.0,
  safe_mode: true,
  safe_mode_min_period_s: 0.35,
  output_format: 'gif',
};

const SPECTRAL_HUE_START_DEG = 0.0;
const SPECTRAL_HUE_END_DEG = 270.0;

/** Convert RGB (0-255) to HSV (0-1) */
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
}

/** Map RGB tuple to 0-255 spectral index on the red->violet ramp */
export function rgbToSpectralIndex(rgb, policy = 'nearest_edge') {
  const [r, g, b] = rgb;
  const { h, s, v } = rgbToHsv(r, g, b);
  const hueDeg = h * 360.0;

  const inArc = hueDeg >= SPECTRAL_HUE_START_DEG && hueDeg <= SPECTRAL_HUE_END_DEG;
  const lowSat = s < 0.12;

  if (inArc && !lowSat) {
    const frac = (hueDeg - SPECTRAL_HUE_START_DEG) / (SPECTRAL_HUE_END_DEG - SPECTRAL_HUE_START_DEG);
    return Math.min(255, Math.max(0, Math.round(frac * 255)));
  }

  // Non-spectral handling
  if (policy === 'nearest_edge') {
    if (lowSat) {
      return v < 0.5 ? 0 : 255;
    }
    const distToRed = Math.min(hueDeg, 360.0 - hueDeg);
    const distToViolet = Math.abs(hueDeg - SPECTRAL_HUE_END_DEG);
    return distToRed < distToViolet ? 0 : 255;
  } else if (policy === 'desaturate_static') {
    return v < 0.5 ? 0 : 255;
  } else if (policy === 'hue_wraparound') {
    return Math.min(255, Math.max(0, Math.round((hueDeg / 360.0) * 255)));
  }
  return 0;
}

/** Extract quantized palette & pixel index map from Canvas ImageData */
export function buildQuantizedPalette(imageData, paletteSize = 256) {
  const data = imageData.data;
  const len = data.length / 4;
  
  // Quick spatial sampling or color frequency map
  const colorMap = new Map();
  const step = Math.max(1, Math.floor(len / 10000)); // Sample if image is huge

  for (let i = 0; i < len; i += step) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Quantize 8-bit to 5-bit for fast color binning
    const key = (r & 0xf8) << 7 | (g & 0xf8) << 2 | (b >> 3);
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Sort colors by count and take top N palette entries
  const sortedBins = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);
  const topBins = sortedBins.slice(0, paletteSize);

  const palette = topBins.map(([key]) => [
    (key >> 7) & 0xf8,
    (key >> 2) & 0xf8,
    (key << 3) & 0xf8,
  ]);

  // If palette is empty, fallback to black/white
  if (palette.length === 0) {
    palette.push([0, 0, 0], [255, 255, 255]);
  }

  // Map every pixel to nearest palette index
  const pixelIndices = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const pr = data[i * 4];
    const pg = data[i * 4 + 1];
    const pb = data[i * 4 + 2];

    let minDist = Infinity;
    let closestIdx = 0;

    for (let p = 0; p < palette.length; p++) {
      const [r, g, b] = palette[p];
      const dr = pr - r;
      const dg = pg - g;
      const db = pb - b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        closestIdx = p;
        if (dist === 0) break;
      }
    }
    pixelIndices[i] = closestIdx;
  }

  return { palette, pixelIndices };
}

/** Build Palette Map table with spectral indices and strobe durations */
export function buildPaletteMap(palette, pixelIndices, config) {
  const usedSet = new Set(pixelIndices);
  const usedIndices = Array.from(usedSet).sort((a, b) => a - b);

  const base = config.base_strobe_length_s;
  const inc = config.strobe_increment_s;
  const reversed = config.direction === 'violet_to_red';
  const safe = config.safe_mode;
  const floor = config.safe_mode_min_period_s;
  const policy = config.non_spectral_color_policy;

  const entries = usedIndices.map((idx) => {
    const rgb = palette[idx];
    const spectralIndex = rgbToSpectralIndex(rgb, policy);
    const effIndex = reversed ? (255 - spectralIndex) : spectralIndex;
    
    let strobeLength = base + effIndex * inc;
    if (safe && strobeLength < floor) {
      strobeLength = floor;
    }

    return {
      palette_index: idx,
      rgb,
      spectral_index: spectralIndex,
      strobe_length_s: Number(strobeLength.toFixed(4)),
    };
  });

  return entries;
}

/** Compute 3-phase envelope brightness (0.0 to 1.0) */
export function getEnvelopeBrightness(t, period, ratios) {
  if (period <= 0) return 1.0;
  const phaseT = t % period;
  const frac = phaseT / period;
  const { start: s, persist: p, end: e } = ratios;

  if (frac < s) {
    return s > 0 ? frac / s : 1.0;
  } else if (frac < s + p) {
    return 1.0;
  } else {
    const endFrac = e > 0 ? (frac - s - p) / e : 1.0;
    return Math.max(0.0, 1.0 - endFrac);
  }
}

/** Generate synthetic rainbow test image for instant demo */
export function createSelfTestImage(width = 120, height = 120) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let x = 0; x < width; x++) {
    const hueDeg = (x / (width - 1)) * SPECTRAL_HUE_END_DEG;
    const { r, g, b } = hsvToRgb(hueDeg / 360.0, 1.0, 1.0);
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// ─── Pure-JS GIF89a Encoder ────────────────────────────────────────────────
// Implements GIF89a spec: header, global color table, Netscape loop extension,
// per-frame graphic control extension, and LZW-compressed image data.

function gifLZWEncode(indexedPixels, colorDepth) {
  const minCodeSize = Math.max(2, colorDepth);
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let nextCode = eoiCode + 1;
  let codeSize = minCodeSize + 1;
  let maxCode = 1 << codeSize;

  const output = [];
  let buf = 0;
  let bufBits = 0;

  const emit = (code) => {
    buf |= code << bufBits;
    bufBits += codeSize;
    while (bufBits >= 8) {
      output.push(buf & 0xff);
      buf >>= 8;
      bufBits -= 8;
    }
  };

  // LZW compression
  const table = new Map();
  const resetTable = () => {
    table.clear();
    for (let i = 0; i < clearCode; i++) table.set(String(i), i);
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
    maxCode = 1 << codeSize;
  };

  resetTable();
  emit(clearCode);

  let prefix = String(indexedPixels[0]);
  for (let i = 1; i < indexedPixels.length; i++) {
    const suffix = String(indexedPixels[i]);
    const key = prefix + ',' + suffix;
    if (table.has(key)) {
      prefix = key;
    } else {
      emit(table.get(prefix));
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode = 1 << codeSize;
        }
      } else {
        emit(clearCode);
        resetTable();
      }
      prefix = suffix;
    }
  }
  emit(table.get(prefix));
  emit(eoiCode);

  if (bufBits > 0) output.push(buf & 0xff);
  return output;
}

function buildGifBytes(width, height, frames, palette, delayCs) {
  // Palette must be power-of-2 in size, min 4
  let palSize = 4;
  while (palSize < palette.length) palSize *= 2;
  if (palSize > 256) palSize = 256;
  const colorDepth = Math.max(2, Math.ceil(Math.log2(palSize)));
  const palFlag = colorDepth - 1; // packed field bits 0-2

  const out = [];

  const b = (byte) => out.push(byte & 0xff);
  const word = (w) => { b(w & 0xff); b((w >> 8) & 0xff); };
  const bytes = (arr) => arr.forEach(x => b(x));

  // GIF89a Header
  bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // 'GIF89a'

  // Logical Screen Descriptor
  word(width);
  word(height);
  b(0x80 | (palFlag << 4) | palFlag); // Global Color Table Flag + size
  b(0);   // background color index
  b(0);   // pixel aspect ratio

  // Global Color Table
  for (let i = 0; i < palSize; i++) {
    const rgb = palette[i] || [0, 0, 0];
    b(rgb[0]); b(rgb[1]); b(rgb[2]);
  }

  // Netscape 2.0 Application Extension (infinite loop)
  bytes([0x21, 0xff, 0x0b]); // Extension + App Extension label + block size 11
  bytes([0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]); // NETSCAPE2.0
  bytes([0x03, 0x01]); // sub-block size 3, id 1
  word(0);  // repeat count 0 = infinite
  b(0x00);  // block terminator

  // Write each frame
  for (const framePixels of frames) {
    // Graphic Control Extension (disposal=2 restore-to-bg)
    bytes([0x21, 0xf9, 0x04]);
    b(0x08 | (2 << 2)); // flags: disposal method 2
    word(delayCs);       // delay in centiseconds
    b(0);                // transparent color index (none)
    b(0x00);             // block terminator

    // Image Descriptor
    b(0x2c);
    word(0); word(0);     // left, top
    word(width); word(height);
    b(0x00);              // no local palette, not interlaced

    // LZW Image Data
    const lzwData = gifLZWEncode(framePixels, colorDepth);
    b(colorDepth);       // LZW minimum code size

    // Write in sub-blocks of max 255 bytes
    let pos = 0;
    while (pos < lzwData.length) {
      const blockLen = Math.min(255, lzwData.length - pos);
      b(blockLen);
      for (let k = 0; k < blockLen; k++) b(lzwData[pos++]);
    }
    b(0x00); // block terminator
  }

  b(0x3b); // GIF Trailer
  return new Uint8Array(out);
}

/**
 * WYSIWYG GIF encoder — takes an array of pre-rendered RGBA Uint8ClampedArrays
 * (one per frame, captured directly from the canvas via getImageData) and encodes
 * them as a looping GIF89a. Because the pixels come straight from the canvas, every
 * visual modifier (solo color, hover dim, desaturate-static, brightness envelope,
 * phase ratios, safe-mode clamping) is automatically included — no recomputation.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8ClampedArray[]} rawFrames  - RGBA pixel data per frame (from getImageData)
 * @param {number} frameDelayCs            - inter-frame delay in centiseconds
 * @param {function} [onProgress]          - optional callback(0-100)
 */
export function exportGifFromRawFrames(width, height, rawFrames, frameDelayCs, onProgress) {
  // ── Step 1: Build a shared palette by sampling rendered colors across frames ──
  const colorFreq = new Map();
  // Sample at most every Nth frame and every Mth pixel to stay fast
  const frameSample = Math.max(1, Math.floor(rawFrames.length / 20));
  const pixelCount = width * height;
  const pixSample = Math.max(1, Math.floor(pixelCount / 5000));

  for (let fi = 0; fi < rawFrames.length; fi += frameSample) {
    const data = rawFrames[fi];
    for (let i = 0; i < pixelCount; i += pixSample) {
      // Quantize to 5-bit per channel (32 levels) to reduce palette churn
      const r = data[i * 4]     & 0xf8;
      const g = data[i * 4 + 1] & 0xf8;
      const b = data[i * 4 + 2] & 0xf8;
      const key = (r << 16) | (g << 8) | b;
      colorFreq.set(key, (colorFreq.get(key) || 0) + 1);
    }
  }

  // Take the 255 most-frequent colors; index 0 is reserved for black
  const topColors = Array.from(colorFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 255)
    .map(([key]) => [(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff]);

  const palette = [[0, 0, 0], ...topColors]; // index 0 = black

  // ── Step 2: Memoized nearest-palette-color lookup ─────────────────────────────
  // Colors are scaled variants of a small source palette, so distinct RGB tuples
  // are bounded → memoization makes this fast in practice.
  const nearestCache = new Map();
  const findNearest = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    if (nearestCache.has(key)) return nearestCache.get(key);
    let minDist = Infinity, best = 0;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0];
      const dg = g - palette[p][1];
      const db = b - palette[p][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < minDist) { minDist = d; best = p; if (d === 0) break; }
    }
    nearestCache.set(key, best);
    return best;
  };

  // ── Step 3: Convert each RGBA frame to palette-indexed frame ─────────────────
  const indexedFrames = rawFrames.map((data, fi) => {
    const indexed = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      indexed[i] = findNearest(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    }
    if (onProgress) onProgress(Math.round((fi / rawFrames.length) * 100));
    return indexed;
  });

  const gifBytes = buildGifBytes(width, height, indexedFrames, palette, frameDelayCs);
  return new Blob([gifBytes], { type: 'image/gif' });
}

/** Render all animation frames and encode as GIF89a.
 * Renders N frames, applying 3-phase brightness envelope per pixel.
 * Returns a Blob of type image/gif.
 */
export function exportGif(width, height, pixelIndices, paletteMap, config, onProgress, playbackSpeed = 1.0) {
  const fps = config.fps || 30;
  const duration = config.max_duration_s || 3.0;
  // Cap frames to prevent huge file: 10s × 30fps = 300 frames max
  const nFrames = Math.min(300, Math.max(1, Math.round(duration * fps)));
  // Scale delay by playbackSpeed so 0.25× preview → 4× longer frame delay in the GIF
  const frameDelayCs = Math.max(2, Math.round((100 / fps) / Math.max(0.01, playbackSpeed)));

  // Build per-palette-index lookup tables
  const maxPi = Math.max(...paletteMap.map(e => e.palette_index));
  const strobeLenByPi = new Float64Array(maxPi + 1);
  const rgbByPi = new Array(maxPi + 1).fill(null);

  paletteMap.forEach((entry) => {
    strobeLenByPi[entry.palette_index] = entry.strobe_length_s;
    rgbByPi[entry.palette_index] = entry.rgb;
  });

  // Build a compact sequential palette (GIF indices must be 0-based sequential)
  // We need: palette[gifIdx] = [r,g,b], and a map from original palette_index -> gifIdx
  const gifPalette = [];
  const piToGifIdx = new Map();
  // Index 0 = black (used for fully-dark pixels)
  gifPalette.push([0, 0, 0]);
  piToGifIdx.set(-1, 0); // sentinel

  paletteMap.forEach((entry, i) => {
    const gifIdx = gifPalette.length;
    gifPalette.push(entry.rgb);
    piToGifIdx.set(entry.palette_index, gifIdx);
  });

  const numPixels = width * height;
  const ratios = config.phase_ratios;
  const frames = [];

  for (let f = 0; f < nFrames; f++) {
    const t = f / fps;
    const framePixels = new Uint8Array(numPixels);

    for (let p = 0; p < numPixels; p++) {
      const pi = pixelIndices[p];
      const period = strobeLenByPi[pi];
      const brightness = getEnvelopeBrightness(t, period, ratios);
      const gifIdx = piToGifIdx.get(pi) ?? 0;

      // If brightness is very low, map to black (index 0)
      // Otherwise we scale brightness by picking the real color index
      // (True RGB-brightness scaling would need per-frame palettes — for now, hard-threshold)
      framePixels[p] = brightness < 0.08 ? 0 : gifIdx;
    }

    frames.push(framePixels);
    if (onProgress) onProgress(Math.round((f / nFrames) * 100));
  }

  const gifBytes = buildGifBytes(width, height, frames, gifPalette, frameDelayCs);
  return new Blob([gifBytes], { type: 'image/gif' });
}
