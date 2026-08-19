import React from 'react';
import { Sliders, RotateCcw, ShieldCheck, Download, Code } from 'lucide-react';
import { DEFAULT_CONFIG } from '../utils/strobeEngine';

export default function DevConfigPanel({ config, onChangeConfig, onReset }) {
  const update = (key, val) => {
    onChangeConfig({ ...config, [key]: val });
  };

  const updatePhase = (phaseKey, val) => {
    const num = parseFloat(val);
    const newRatios = { ...config.phase_ratios, [phaseKey]: num };
    onChangeConfig({ ...config, phase_ratios: newRatios });
  };

  const exportConfigJson = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strobe_dev_config_v${config.version || 1}.json`;
    a.click();
  };

  return (
    <aside className="glass-panel" style={{ width: '320px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.95rem' }}>
          <Sliders size={18} color="var(--accent-cyan)" />
          Dev-Mode Config Panel
        </div>
        <button className="btn btn-secondary btn-icon" onClick={onReset} title="Reset to Defaults" style={{ width: '28px', height: '28px' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Base Strobe Length */}
      <div className="input-group">
        <div className="input-label">
          <span>Base Strobe (Red, i=0)</span>
          <span className="input-value">{config.base_strobe_length_s.toFixed(3)} s</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="1.0" 
          step="0.01" 
          value={config.base_strobe_length_s}
          onChange={(e) => update('base_strobe_length_s', parseFloat(e.target.value))}
        />
      </div>

      {/* Increment per spectral step */}
      <div className="input-group">
        <div className="input-label">
          <span>Increment / Step</span>
          <span className="input-value">{config.strobe_increment_s.toFixed(4)} s</span>
        </div>
        <input 
          type="range" 
          min="0.000" 
          max="0.020" 
          step="0.0005" 
          value={config.strobe_increment_s}
          onChange={(e) => update('strobe_increment_s', parseFloat(e.target.value))}
        />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Violet (i=255) period = {(config.base_strobe_length_s + 255 * config.strobe_increment_s).toFixed(3)}s
        </span>
      </div>

      {/* Ramp Direction */}
      <div className="input-group">
        <div className="input-label">
          <span>Spectrum Direction</span>
        </div>
        <select 
          value={config.direction} 
          onChange={(e) => update('direction', e.target.value)}
        >
          <option value="red_to_violet">Red → Violet (Default: Shortest → Longest)</option>
          <option value="violet_to_red">Violet → Red (Reversed)</option>
        </select>
      </div>

      {/* Palette Size & Quantization */}
      <div className="input-group">
        <div className="input-label">
          <span>Palette Size (Colors)</span>
          <span className="input-value">{config.palette_size}</span>
        </div>
        <input 
          type="range" 
          min="2" 
          max="256" 
          step="2" 
          value={config.palette_size}
          onChange={(e) => update('palette_size', parseInt(e.target.value))}
        />
      </div>

      <div className="input-group">
        <div className="input-label">
          <span>Quantization Algorithm</span>
        </div>
        <select 
          value={config.quantization_algorithm} 
          onChange={(e) => update('quantization_algorithm', e.target.value)}
        >
          <option value="median_cut">Median-Cut (Recommended)</option>
          <option value="octree">Fast Octree</option>
          <option value="none">None (Use Source Palette)</option>
        </select>
      </div>

      {/* Non-Spectral Color Policy */}
      <div className="input-group">
        <div className="input-label">
          <span>Non-Spectral Color Policy</span>
        </div>
        <select 
          value={config.non_spectral_color_policy} 
          onChange={(e) => update('non_spectral_color_policy', e.target.value)}
        >
          <option value="nearest_edge">Nearest Edge (Default: Red/Violet Clamp)</option>
          <option value="desaturate_static">Desaturate Static (No Strobe)</option>
          <option value="hue_wraparound">Hue Wraparound (360° Linear)</option>
        </select>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Controls grays, magentas, and skin tones.
        </span>
      </div>

      {/* 3-Phase Envelope Ratios */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <div className="input-label" style={{ marginBottom: '10px', color: 'var(--text-main)', fontWeight: '600' }}>
          3-Beat Envelope (Start / Persist / End)
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Start (Fade-in)</span>
            <span className="input-value">{(config.phase_ratios.start * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="0.5" 
            step="0.05" 
            value={config.phase_ratios.start}
            onChange={(e) => updatePhase('start', e.target.value)}
          />
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Persist (Hold)</span>
            <span className="input-value">{(config.phase_ratios.persist * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="0.8" 
            step="0.05" 
            value={config.phase_ratios.persist}
            onChange={(e) => updatePhase('persist', e.target.value)}
          />
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>End (Fade-out)</span>
            <span className="input-value">{(config.phase_ratios.end * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="0.5" 
            step="0.05" 
            value={config.phase_ratios.end}
            onChange={(e) => updatePhase('end', e.target.value)}
          />
        </div>
      </div>

      {/* Safety & Timing */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <div className="input-label" style={{ marginBottom: '10px', color: 'var(--text-main)', fontWeight: '600' }}>
          Safety & Render Timing
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Safe Mode Min Period</span>
            <span className="input-value">{config.safe_mode_min_period_s.toFixed(2)} s</span>
          </div>
          <input 
            type="range" 
            min="0.2" 
            max="0.6" 
            step="0.05" 
            value={config.safe_mode_min_period_s}
            onChange={(e) => update('safe_mode_min_period_s', parseFloat(e.target.value))}
          />
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Target FPS</span>
            <span className="input-value">{config.fps} fps</span>
          </div>
          <select 
            value={config.fps} 
            onChange={(e) => update('fps', parseInt(e.target.value))}
          >
            <option value={15}>15 FPS (Compact File)</option>
            <option value={30}>30 FPS (Default smooth)</option>
            <option value={60}>60 FPS (Ultra Smooth)</option>
          </select>
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>GIF Output Duration</span>
            <span className="input-value">{config.max_duration_s} s</span>
          </div>
          <input 
            type="range" 
            min="1.0" 
            max="10.0" 
            step="0.5" 
            value={config.max_duration_s}
            onChange={(e) => update('max_duration_s', parseFloat(e.target.value))}
          />
        </div>
      </div>

      <button className="btn btn-secondary" onClick={exportConfigJson} style={{ width: '100%', marginTop: '8px' }}>
        <Download size={16} /> Export Dev Config JSON
      </button>
    </aside>
  );
}
