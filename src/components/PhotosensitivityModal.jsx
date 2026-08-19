import React from 'react';
import { AlertTriangle, ShieldCheck, Play, EyeOff } from 'lucide-react';

export default function PhotosensitivityModal({ isOpen, onAccept, onEnableSafeMode, onReducedMotion }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="safety-title">
      <div className="glass-panel spectral-border" style={{ maxWidth: '520px', width: '100%', padding: '28px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'rgba(255, 136, 0, 0.15)', color: 'var(--accent-orange)', marginBottom: '16px' }}>
          <AlertTriangle size={42} />
        </div>

        <h2 id="safety-title" style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '10px' }}>
          Photosensitivity Warning
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '18px' }}>
          This application generates temporal strobe lightscapes where colors pulse continuously at frequencies between <strong>0.2s (5 Hz)</strong> and <strong>1.5s</strong>.
        </p>

        <div style={{ background: 'rgba(10, 14, 26, 0.8)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'left', marginBottom: '22px', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: '600', color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Compliance & Safety (WCAG 2.3.1)
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Flicker frequencies between 3Hz – 60Hz can trigger photosensitive epileptic seizures. Enabling <strong>Safe Mode</strong> automatically clamps all strobe rates to stay safely below 2.86Hz (0.35s floor).
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn btn-primary" onClick={onEnableSafeMode} style={{ width: '100%' }}>
            <ShieldCheck size={18} /> Enable Safe Mode & Proceed (Recommended)
          </button>

          <button className="btn btn-secondary" onClick={onAccept} style={{ width: '100%' }}>
            <Play size={18} /> I Understand — Proceed in Full Strobe Mode
          </button>

          <button className="btn btn-secondary" onClick={onReducedMotion} style={{ width: '100%', opacity: '0.8' }}>
            <EyeOff size={18} /> Enable Reduced Motion (Static Preview Only)
          </button>
        </div>
      </div>
    </div>
  );
}
