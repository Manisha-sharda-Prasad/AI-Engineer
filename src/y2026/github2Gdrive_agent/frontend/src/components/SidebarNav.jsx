import React from 'react';

export default function SidebarNav({
  activePage,
  onNavigate,
  onOpenAddRepo,
  theme,
  onThemeChange,
  repoCount = 0
}) {
  return (
    <aside className="compact-sidebar">
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', color: 'white', fontWeight: 'bold'
        }}>
          ⚡
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: '800', lineHeight: 1.1 }}>github2Gdrive</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Backup Agent</span>
        </div>
      </div>

      {/* Main Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="nav-section-title">Navigation</div>
        
        <div
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span>🏠</span>
          <span>Dashboard</span>
        </div>

        <div
          className={`nav-item ${activePage === 'repos' ? 'active' : ''}`}
          onClick={() => onNavigate('repos')}
        >
          <span>📁</span>
          <span style={{ flex: 1 }}>Repositories</span>
          <span style={{
            fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)',
            padding: '2px 7px', borderRadius: '10px', color: 'var(--text-muted)'
          }}>
            {repoCount}
          </span>
        </div>

        <div
          className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span>⚙️</span>
          <span>Drive Settings</span>
        </div>
      </div>

      {/* Quick Add Button */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
        onClick={onOpenAddRepo}
      >
        ➕ Add Repository
      </button>

      {/* Theme Switcher */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="nav-section-title">Theme</div>
        <div style={{
          background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '10px',
          display: 'flex', gap: '3px', border: '1px solid var(--border-color)'
        }}>
          <button
            className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px', fontSize: '0.72rem', justifyContent: 'center' }}
            onClick={() => onThemeChange('dark')}
          >
            🌙 Dark
          </button>
          <button
            className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px', fontSize: '0.72rem', justifyContent: 'center' }}
            onClick={() => onThemeChange('light')}
          >
            ☀️ Light
          </button>
          <button
            className={`btn btn-sm ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px', fontSize: '0.72rem', justifyContent: 'center' }}
            onClick={() => onThemeChange('system')}
          >
            💻 System
          </button>
        </div>
      </div>
    </aside>
  );
}
