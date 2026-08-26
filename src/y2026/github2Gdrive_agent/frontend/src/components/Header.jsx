import React from 'react';

export default function Header({ state, onOpenAddRepo, onOpenSettings }) {
  const gdriveMode = state?.gdrive?.mode || 'demo';
  const repoCount = state?.repos?.length || 0;

  return (
    <header className="glass-card" style={{ padding: '18px 28px', marginBottom: '28px', borderRadius: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)'
          }}>
            ⚡
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: '800', background: 'linear-gradient(90deg, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              GitHub ➔ Google Drive Sync Agent
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Automated backup and differential synchronization engine
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: gdriveMode === 'demo' ? '#f59e0b' : '#10b981', display: 'inline-block' }} className="pulse"></span>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
              Drive Mode: <strong style={{ color: 'var(--text-main)' }}>{gdriveMode.toUpperCase()}</strong>
            </span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onOpenSettings}>
            ⚙️ Drive Settings
          </button>

          <button className="btn btn-primary btn-sm" onClick={onOpenAddRepo}>
            ➕ Add Repository
          </button>
        </div>
      </div>
    </header>
  );
}
