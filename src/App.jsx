import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PhotosensitivityModal from './components/PhotosensitivityModal';
import DevConfigPanel from './components/DevConfigPanel';
import CanvasViewer from './components/CanvasViewer';
import PaletteLegend from './components/PaletteLegend';
import SamplePresets from './components/SamplePresets';
import { DEFAULT_CONFIG, createSelfTestImage, buildQuantizedPalette, buildPaletteMap } from './utils/strobeEngine';

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [showSafetyModal, setShowSafetyModal] = useState(true);
  const [devPanelOpen, setDevPanelOpen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const [imageData, setImageData] = useState(null);
  const [pixelIndices, setPixelIndices] = useState(null);
  const [paletteMap, setPaletteMap] = useState([]);
  const [imageTitle, setImageTitle] = useState('Spectral Rainbow Ramp');

  const [hoveredColorIndex, setHoveredColorIndex] = useState(null);
  const [soloColorIndex, setSoloColorIndex] = useState(null);

  // Initialize with self-test rainbow image
  useEffect(() => {
    loadSelfTestImage();
  }, []);

  // Re-process palette whenever image or relevant config changes
  useEffect(() => {
    if (!imageData) return;
    processImageData(imageData, config);
  }, [config.palette_size, config.quantization_algorithm, config.base_strobe_length_s, config.strobe_increment_s, config.direction, config.safe_mode, config.safe_mode_min_period_s, config.non_spectral_color_policy]);

  const processImageData = (rawImageData, activeConfig) => {
    const { palette, pixelIndices: indices } = buildQuantizedPalette(rawImageData, activeConfig.palette_size);
    const pMap = buildPaletteMap(palette, indices, activeConfig);

    setImageData(rawImageData);
    setPixelIndices(indices);
    setPaletteMap(pMap);
  };

  const loadSelfTestImage = () => {
    const canvas = createSelfTestImage(160, 160);
    const ctx = canvas.getContext('2d');
    const rawData = ctx.getImageData(0, 0, 160, 160);
    setImageTitle('Self-Test Rainbow Ramp');
    processImageData(rawData, config);
  };

  const handleSelectPreset = (rawImageData, title) => {
    setImageTitle(title);
    setHoveredColorIndex(null);
    setSoloColorIndex(null);
    processImageData(rawImageData, config);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > config.max_input_size_mb * 1024 * 1024) {
      alert(`File size exceeds max limit of ${config.max_input_size_mb} MB.`);
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        // Clamp huge images for fast browser canvas processing
        const maxDim = Math.min(img.width, img.height, 480);
        const scale = maxDim / Math.max(img.width, img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const rawData = ctx.getImageData(0, 0, w, h);
        setImageTitle(file.name);
        setHoveredColorIndex(null);
        setSoloColorIndex(null);
        processImageData(rawData, config);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleToggleSafeMode = () => {
    const nextSafe = !config.safe_mode;
    setConfig((prev) => ({ ...prev, safe_mode: nextSafe }));
  };

  const exportLegendJson = () => {
    const payload = {
      config_used: config,
      palette_map: paletteMap,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${imageTitle.replace(/\s+/g, '_')}_palette_map.json`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Safety Warning Modal */}
      <PhotosensitivityModal 
        isOpen={showSafetyModal}
        onAccept={() => {
          setShowSafetyModal(false);
        }}
        onEnableSafeMode={() => {
          setConfig((prev) => ({ ...prev, safe_mode: true }));
          setShowSafetyModal(false);
        }}
        onReducedMotion={() => {
          setReducedMotion(true);
          setShowSafetyModal(false);
        }}
      />

      {/* Header */}
      <Header 
        safeMode={config.safe_mode}
        onToggleSafeMode={handleToggleSafeMode}
        devPanelOpen={devPanelOpen}
        onToggleDevPanel={() => setDevPanelOpen(!devPanelOpen)}
        onShowInfoModal={() => setShowSafetyModal(true)}
      />

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', padding: '16px', overflow: 'hidden' }}>
        {/* Left: Dev Config Panel */}
        {devPanelOpen && (
          <DevConfigPanel 
            config={config}
            onChangeConfig={setConfig}
            onReset={() => setConfig(DEFAULT_CONFIG)}
          />
        )}

        {/* Center: Canvas Animation & Controls */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
          <SamplePresets 
            onSelectPreset={handleSelectPreset}
            onFileUpload={handleFileUpload}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🖼️</span> {imageTitle}
              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                {imageData ? `${imageData.width}×${imageData.height}` : ''}
              </span>
            </h2>
            {soloColorIndex !== null && (
              <button className="btn btn-secondary" onClick={() => setSoloColorIndex(null)} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                Reset Solo Color
              </button>
            )}
          </div>

          <CanvasViewer 
            imageData={imageData}
            pixelIndices={pixelIndices}
            paletteMap={paletteMap}
            config={config}
            hoveredColorIndex={hoveredColorIndex}
            soloColorIndex={soloColorIndex}
            reducedMotion={reducedMotion}
          />
        </main>

        {/* Right: Palette-Map Legend Sidebar */}
        <aside style={{ width: '320px', display: 'flex', flexDirection: 'column' }}>
          <PaletteLegend 
            paletteMap={paletteMap}
            hoveredColorIndex={hoveredColorIndex}
            onHoverColor={setHoveredColorIndex}
            soloColorIndex={soloColorIndex}
            onSoloColor={setSoloColorIndex}
            onExportLegendJson={exportLegendJson}
          />
        </aside>
      </div>
    </div>
  );
}
