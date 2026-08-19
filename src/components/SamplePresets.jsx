import React from 'react';
import { Image as ImageIcon, Sparkles, Upload } from 'lucide-react';
import { createSelfTestImage } from '../utils/strobeEngine';

export default function SamplePresets({ onSelectPreset, onFileUpload }) {
  const loadRainbowSelfTest = () => {
    const canvas = createSelfTestImage(160, 160);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 160, 160);
    onSelectPreset(imageData, 'Self-Test Rainbow Ramp');
  };

  const loadCyberpunkPreset = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Create multi-stop gradient
    const grad = ctx.createLinearGradient(0, 0, 160, 160);
    grad.addColorStop(0, '#ff0055');
    grad.addColorStop(0.25, '#ffaa00');
    grad.addColorStop(0.5, '#00ffcc');
    grad.addColorStop(0.75, '#0066ff');
    grad.addColorStop(1, '#9900ff');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 160, 160);

    // Draw grid lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 160; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 160); ctx.stroke();
    }
    for (let y = 0; y <= 160; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(160, y); ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, 160, 160);
    onSelectPreset(imageData, 'Cyberpunk Neon Grid');
  };

  const loadRetroSprite = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6'];
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const c = colors[(x + y) % colors.length];
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const imageData = ctx.getImageData(0, 0, 16, 16);
    onSelectPreset(imageData, '16x16 Pixel Sprite');
  };

  return (
    <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
          <Sparkles size={16} color="var(--accent-yellow)" />
          Sample Demo Presets
        </div>
        <label className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
          <Upload size={14} /> Upload Custom Image
          <input type="file" accept="image/*" onChange={onFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        <button className="btn btn-secondary" onClick={loadRainbowSelfTest} style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}>
          🌈 Spectral Rainbow
        </button>
        <button className="btn btn-secondary" onClick={loadCyberpunkPreset} style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}>
          ⚡ Cyberpunk Grid
        </button>
        <button className="btn btn-secondary" onClick={loadRetroSprite} style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}>
          👾 8-Bit Pixel Sprite
        </button>
      </div>
    </div>
  );
}
