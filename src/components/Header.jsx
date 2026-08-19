import React from 'react';
import { Sparkles, Sliders, ShieldCheck, HelpCircle, Layers } from 'lucide-react';

export default function Header({ safeMode, onToggleSafeMode, onToggleDevPanel, devPanelOpen, onShowInfoModal }) {
  return (
    <header className="glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(255, 0, 128, 0.4)' }}>
          <Sparkles size={22} color="#fff" />
        </div>
        <div>
          <h1 className="shimmer-text" style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            STROBE CHROMATICS
            <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>M0/M1 Engine</span>
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            8-Bit Temporal Spectral Engine · Color as Duration
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          className={`btn ${safeMode ? 'btn-secondary' : 'btn-danger'}`} 
          onClick={onToggleSafeMode} 
          title="Toggle Safe Mode minimum period clamp"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <ShieldCheck size={16} />
          {safeMode ? 'Safe Mode: ON (2.86 Hz)' : 'Safe Mode: OFF (Full 5 Hz)'}
        </button>

        <button 
          className={`btn ${devPanelOpen ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onToggleDevPanel}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <Sliders size={16} />
          Dev Config Panel
        </button>

        <button 
          className="btn btn-secondary btn-icon" 
          onClick={onShowInfoModal}
          title="Concept & Architecture Info"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </header>
  );
}
