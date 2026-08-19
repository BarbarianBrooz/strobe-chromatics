import React, { useState } from 'react';
import { Palette, Eye, Download, Search, Filter } from 'lucide-react';

export default function PaletteLegend({ paletteMap, hoveredColorIndex, onHoverColor, soloColorIndex, onSoloColor, onExportLegendJson }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('spectral'); // 'spectral' | 'duration' | 'index'

  if (!paletteMap || paletteMap.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No palette generated yet. Upload an image to analyze its spectral breakdown.
      </div>
    );
  }

  // Filter & sort palette entries
  const filtered = paletteMap.filter((e) => {
    const rgbStr = `rgb(${e.rgb.join(',')})`;
    const hexStr = `#${e.rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
    return (
      rgbStr.includes(searchTerm) ||
      hexStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.spectral_index.toString().includes(searchTerm) ||
      e.strobe_length_s.toString().includes(searchTerm)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'spectral') return a.spectral_index - b.spectral_index;
    if (sortBy === 'duration') return a.strobe_length_s - b.strobe_length_s;
    return a.palette_index - b.palette_index;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.95rem' }}>
          <Palette size={18} color="var(--accent-purple)" />
          Palette-Map Legend
          <span className="badge badge-cyan">{paletteMap.length} Colors</span>
        </div>

        <button className="btn btn-secondary" onClick={onExportLegendJson} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
          <Download size={14} /> Export Map JSON
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Search RGB / Spectral Index..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '30px',
              paddingRight: '10px',
              paddingTop: '6px',
              paddingBottom: '6px',
              background: 'rgba(10, 14, 26, 0.8)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: '130px', fontSize: '0.75rem', padding: '4px 8px' }}
        >
          <option value="spectral">Sort: Spectral Index</option>
          <option value="duration">Sort: Strobe Duration</option>
          <option value="index">Sort: Original Index</option>
        </select>
      </div>

      {/* Palette Legend List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
        {sorted.map((entry) => {
          const [r, g, b] = entry.rgb;
          const isHovered = hoveredColorIndex === entry.palette_index;
          const isSoloed = soloColorIndex === entry.palette_index;
          const rgbCss = `rgb(${r}, ${g}, ${b})`;

          return (
            <div 
              key={entry.palette_index}
              onMouseEnter={() => onHoverColor(entry.palette_index)}
              onMouseLeave={() => onHoverColor(null)}
              onClick={() => onSoloColor(isSoloed ? null : entry.palette_index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: isSoloed 
                  ? 'rgba(0, 229, 255, 0.2)' 
                  : isHovered 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(10, 14, 26, 0.5)',
                border: isSoloed 
                  ? '1px solid var(--accent-cyan)' 
                  : isHovered 
                  ? '1px solid rgba(255, 255, 255, 0.2)' 
                  : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '6px', 
                    background: rgbCss,
                    boxShadow: `0 0 8px ${rgbCss}`,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }} 
                />
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600' }}>
                    {rgbCss}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Spectral Step: #{entry.spectral_index}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-yellow)' }}>
                  ⚡ {entry.strobe_length_s.toFixed(3)}s
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  {(1 / entry.strobe_length_s).toFixed(1)} Hz
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
