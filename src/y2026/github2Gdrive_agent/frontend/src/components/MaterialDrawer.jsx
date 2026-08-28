import React, { useState } from 'react';

// SVG Icons
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconRepoSync = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMonitor = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export default function MaterialDrawer({
  activePage,
  onNavigate,
  onOpenAddRepo,
  theme,
  onThemeChange,
  repoCount = 0
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside className={`material-drawer ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'space-between' : 'center', width: '100%' }}>
        {isExpanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="circular-avatar"
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--md-primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem'
              }}
            >
              G
            </div>
            <span style={{ fontWeight: '800', fontSize: '0.98rem', letterSpacing: '-0.2px' }}>
              github2Gdrive
            </span>
          </div>
        )}

        <button
          className="drawer-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <IconMenu />
        </button>
      </div>

      {/* Navigation List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
        <div
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
          title="Home Dashboard"
        >
          <span className="nav-item-icon"><IconHome /></span>
          {isExpanded && <span>Home</span>}
        </div>

        <div
          className={`nav-item ${activePage === 'repos' ? 'active' : ''}`}
          onClick={() => onNavigate('repos')}
          title="Repo Sync"
        >
          <span className="nav-item-icon"><IconRepoSync /></span>
          {isExpanded && (
            <>
              <span style={{ flex: 1 }}>Repo Sync</span>
              <span style={{
                fontSize: '0.72rem', background: 'var(--md-surface-variant)',
                padding: '2px 7px', color: 'var(--md-text-secondary)'
              }}>
                {repoCount}
              </span>
            </>
          )}
        </div>

        <div
          className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
          title="Drive & Theme Settings"
        >
          <span className="nav-item-icon"><IconSettings /></span>
          {isExpanded && <span>Settings</span>}
        </div>
      </div>

      {/* Add Repo Button */}
      <button
        className="btn btn-primary"
        style={{
          width: '100%', justifyContent: isExpanded ? 'flex-start' : 'center',
          marginTop: '6px', padding: isExpanded ? '9px 14px' : '9px 0'
        }}
        onClick={onOpenAddRepo}
        title="Add Repository"
      >
        <IconPlus />
        {isExpanded && <span>Add Repo</span>}
      </button>

      {/* Bottom Theme Controls - Unclipped with padding-bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isExpanded && (
          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--md-text-disabled)', textTransform: 'uppercase' }}>
            Theme
          </div>
        )}

        <div style={{
          background: 'var(--md-surface-variant)', padding: '3px',
          display: 'flex', gap: '2px', justifyContent: isExpanded ? 'stretch' : 'center'
        }}>
          <button
            className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '6px 4px', fontSize: '0.72rem', justifyContent: 'center' }}
            onClick={() => onThemeChange('dark')}
            title="Dark Theme"
          >
            <IconMoon />
            {isExpanded && <span>Dark</span>}
          </button>

          {isExpanded && (
            <>
              <button
                className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '6px 4px', fontSize: '0.72rem', justifyContent: 'center' }}
                onClick={() => onThemeChange('light')}
                title="Light Theme"
              >
                <IconSun />
                <span>Light</span>
              </button>
              <button
                className={`btn btn-sm ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '6px 4px', fontSize: '0.72rem', justifyContent: 'center' }}
                onClick={() => onThemeChange('system')}
                title="System Theme"
              >
                <IconMonitor />
                <span>Auto</span>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
