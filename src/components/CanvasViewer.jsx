import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, RefreshCw, Eye, EyeOff, Layers, Zap } from 'lucide-react';
import { getEnvelopeBrightness, exportGifFromRawFrames } from '../utils/strobeEngine';

export default function CanvasViewer({ 
  imageData, 
  pixelIndices, 
  paletteMap, 
  config, 
  hoveredColorIndex, 
  soloColorIndex,
  reducedMotion 
}) {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const animFrameId = useRef(null);
  const lastTimestamp = useRef(null);

  const width = imageData?.width || 0;
  const height = imageData?.height || 0;

  // Real-time animation loop
  useEffect(() => {
    if (!imageData || !pixelIndices || !paletteMap || paletteMap.length === 0) return;
    if (reducedMotion) {
      // Draw static preview frame
      drawFrameAtTime(0);
      return;
    }

    const maxDuration = config.max_duration_s || 3.0;

    const renderLoop = (timestamp) => {
      if (!lastTimestamp.current) lastTimestamp.current = timestamp;
      const dt = (timestamp - lastTimestamp.current) / 1000.0;
      lastTimestamp.current = timestamp;

      if (isPlaying) {
        setCurrentTime((prev) => {
          let next = prev + dt * playbackSpeed;
          if (next >= maxDuration) {
            next = next % maxDuration; // Loop back
          }
          return next;
        });
      }

      animFrameId.current = requestAnimationFrame(renderLoop);
    };

    animFrameId.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      lastTimestamp.current = null;
    };
  }, [imageData, pixelIndices, paletteMap, config, isPlaying, playbackSpeed, reducedMotion]);

  // Re-draw canvas whenever currentTime or hover/solo state changes
  useEffect(() => {
    drawFrameAtTime(currentTime);
  }, [currentTime, hoveredColorIndex, soloColorIndex, config]);

  const drawFrameAtTime = (t) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData || !pixelIndices || !paletteMap) return;

    const ctx = canvas.getContext('2d');
    const outData = ctx.createImageData(width, height);
    const data = outData.data;
    const len = pixelIndices.length;

    // Fast lookup array construction
    const maxIdx = Math.max(...paletteMap.map(e => e.palette_index));
    const strobeLenByPi = new Float64Array(maxIdx + 1);
    const rgbByPi = new Array(maxIdx + 1);

    paletteMap.forEach((entry) => {
      strobeLenByPi[entry.palette_index] = entry.strobe_length_s;
      rgbByPi[entry.palette_index] = entry.rgb;
    });

    const ratios = config.phase_ratios;
    const policy = config.non_spectral_color_policy;

    for (let i = 0; i < len; i++) {
      const pi = pixelIndices[i];
      const rgb = rgbByPi[pi];
      if (!rgb) continue;

      const period = strobeLenByPi[pi];
      let brightness = getEnvelopeBrightness(t, period, ratios);

      // Desaturate static policy handling for non-spectral colors
      if (policy === 'desaturate_static' && (pi === 0 || pi === maxIdx)) {
        brightness = 1.0;
      }

      // Solo color or Hover color highlighting
      if (soloColorIndex !== null) {
        if (pi !== soloColorIndex) {
          brightness *= 0.15; // Dim non-soloed colors
        }
      } else if (hoveredColorIndex !== null) {
        if (pi === hoveredColorIndex) {
          brightness = 1.0; // Glow hovered color
        } else {
          brightness *= 0.5;
        }
      }

      const pixelOffset = i * 4;
      data[pixelOffset] = Math.min(255, Math.round(rgb[0] * brightness));
      data[pixelOffset + 1] = Math.min(255, Math.round(rgb[1] * brightness));
      data[pixelOffset + 2] = Math.min(255, Math.round(rgb[2] * brightness));
      data[pixelOffset + 3] = 255;
    }

    ctx.putImageData(outData, 0, 0);
  };

  const handleStepFrame = (direction) => {
    const fps = config.fps || 30;
    const dt = 1.0 / fps;
    const maxDuration = config.max_duration_s || 3.0;
    setCurrentTime((prev) => {
      let next = prev + direction * dt;
      if (next < 0) next = maxDuration + next;
      if (next >= maxDuration) next = next % maxDuration;
      return next;
    });
  };

  const handleExportGif = () => {
    if (!canvasRef.current || !imageData) return;
    setIsExporting(true);
    setExportProgress(0);

    // Use a small delay so the UI can paint the "Encoding..." state before we block
    setTimeout(() => {
      try {
        const fps       = config.fps || 30;
        const duration  = config.max_duration_s || 3.0;
        const nFrames   = Math.min(300, Math.max(1, Math.round(duration * fps)));
        // Frame delay respects the playback speed exactly as the canvas preview does
        const frameDelayCs = Math.max(2, Math.round((100 / fps) / Math.max(0.01, playbackSpeed)));

        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        const rawFrames = [];

        // ── Capture every frame exactly as rendered on canvas ──────────────────
        // drawFrameAtTime already applies: envelope brightness, phase ratios,
        // desaturate-static policy, solo-color dimming, hover highlight, safe-mode
        // clamping, and direction — nothing needs to be re-derived here.
        for (let f = 0; f < nFrames; f++) {
          const t = f / fps;
          drawFrameAtTime(t);
          const imgData = ctx.getImageData(0, 0, width, height);
          rawFrames.push(new Uint8ClampedArray(imgData.data));
          // Update progress every 5 frames (70% of bar = capture phase)
          if (f % 5 === 0) {
            setExportProgress(Math.round((f / nFrames) * 70));
          }
        }

        setExportProgress(72);

        // ── Encode captured frames as GIF89a (30% of bar = encoding phase) ────
        const gifBlob = exportGifFromRawFrames(
          width, height, rawFrames, frameDelayCs,
          (pct) => setExportProgress(72 + Math.round(pct * 0.28))
        );

        setExportProgress(100);
        const url = URL.createObjectURL(gifBlob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `strobe_chromatics_${Date.now()}.gif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        // Restore canvas to the live playback position
        drawFrameAtTime(currentTime);
      } catch (err) {
        console.error('GIF export failed:', err);
        alert('GIF export error: ' + err.message);
      } finally {
        setTimeout(() => setIsExporting(false), 800);
      }
    }, 20);
  };

  const maxDuration = config.max_duration_s || 3.0;

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
      {/* Canvas Rendering Box */}
      <div 
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          background: '#040508',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          minWidth: '320px',
          minHeight: '320px',
          maxWidth: '100%',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
        }}
      >
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height}
          style={{
            maxWidth: '100%',
            maxHeight: '480px',
            objectFit: 'contain',
            borderRadius: 'var(--radius-sm)',
            imageRendering: 'pixelated',
          }}
        />

        {reducedMotion && (
          <div style={{ position: 'absolute', top: '12px', right: '12px' }} className="badge badge-warning">
            <EyeOff size={14} /> Reduced Motion Active
          </div>
        )}
      </div>

      {/* Scrub Bar & Timing readout */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>t = {currentTime.toFixed(3)}s</span>
          <span style={{ color: 'var(--text-muted)' }}>Max Loop = {maxDuration.toFixed(1)}s</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max={maxDuration} 
          step="0.005"
          value={currentTime}
          onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        />
      </div>

      {/* Playback & Export Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => handleStepFrame(-1)}
            title="Step Back 1 Frame"
          >
            <SkipBack size={16} />
          </button>

          <button 
            className="btn btn-primary btn-icon" 
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => handleStepFrame(1)}
            title="Step Forward 1 Frame"
          >
            <SkipForward size={16} />
          </button>

          {/* Speed Selector */}
          <select 
            value={playbackSpeed} 
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            style={{ width: '80px', fontSize: '0.8rem', padding: '6px 8px' }}
          >
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1.0}>1.0× (Normal)</option>
            <option value={1.5}>1.5×</option>
            <option value={2.0}>2.0×</option>
          </select>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleExportGif}
          disabled={isExporting}
          title={`Exports GIF at ${playbackSpeed}× speed — frame delay = ${Math.max(2, Math.round((100 / (config.fps||30)) / playbackSpeed))} cs`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', minWidth: '220px' }}
        >
          {isExporting 
            ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Encoding GIF… {exportProgress}%</>
            : <><Download size={16} /> Export GIF @ {playbackSpeed}×</>
          }
        </button>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
