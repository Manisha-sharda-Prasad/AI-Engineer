import React from 'react';

export default function MasterSidebar({
  repos = [],
  selectedRepoId,
  onSelectRepo,
  onOpenAddRepo,
  onOpenSettings,
  theme,
  onThemeChange,
  gdriveMode
}) {
  return (
    <aside className="master-sidebar">
      {/* Brand Logo & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
        }}>
          ⚡
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', lineHeight: 1.2 }}>github2Gdrive</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sync & Backup Agent</span>
        </div>
      </div>

      {/* Theme Selector */}
      <div style={{ background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '10px', display: 'flex', gap: '4px', border: '1px solid var(--border-color)' }}>
        <button
          className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }}
          onClick={() => onThemeChange('dark')}
          title="Dark Theme"
        >
          🌙 Dark
        </button>
        <button
          className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }}
          onClick={() => onThemeChange('light')}
          title="Light Theme"
        >
          ☀️ Light
        </button>
        <button
          className={`btn btn-sm ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', justifyContent: 'center' }}
          onClick={() => onThemeChange('system')}
          title="System Default Theme"
        >
          💻 System
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="btn btn-primary" onClick={onOpenAddRepo} style={{ justifyContent: 'center' }}>
          ➕ Add Repository
        </button>
        <button className="btn btn-secondary" onClick={onOpenSettings} style={{ justifyContent: 'center' }}>
          ⚙️ Drive Settings ({gdriveMode?.toUpperCase() || 'DEMO'})
        </button>
      </div>

      {/* Repositories Master List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
          <span>Repositories ({repos.length})</span>
        </div>

        {repos.length === 0 ? (
          <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No repos added yet.<br />Click "+ Add Repository".
          </div>
        ) : (
          repos.map(repo => {
            const isSelected = repo.id === selectedRepoId;
            return (
              <div
                key={repo.id}
                className={`repo-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectRepo(repo.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.92rem' }}>{repo.name}</span>
                  <span className={`badge ${repo.type === 'local' ? 'badge-local' : 'badge-remote'}`}>
                    {repo.type === 'local' ? 'LOCAL' : 'REMOTE'}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.path_or_url}
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  branch: {repo.branch || 'main'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
