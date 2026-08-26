import React from 'react';

export default function RepoList({ repos, onSync, onInspectDiff, onDeleteRepo }) {
  if (!repos || repos.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '12px' }}>No repositories configured yet.</p>
        <p style={{ fontSize: '0.88rem' }}>Click <strong>Add Repository</strong> above to connect a local folder or remote GitHub repo.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Connected Repositories</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{repos.length} configured</span>
      </div>

      {repos.map((repo) => (
        <div key={repo.id} className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span className={`badge ${repo.type === 'local' ? 'badge-local' : 'badge-remote'}`}>
                  {repo.type === 'local' ? '💻 LOCAL' : '🌐 GITHUB'}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{repo.name}</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>branch: {repo.branch || 'main'}</span>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {repo.path_or_url}
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                <span>📁 Google Drive Target: <strong style={{ color: 'var(--text-main)' }}>{repo.target_folder_name || `Backup_${repo.name}`}</strong></span>
                <span>⏱️ Last Synced: <strong style={{ color: 'var(--text-main)' }}>{repo.last_synced ? new Date(repo.last_synced).toLocaleString() : 'Never'}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onInspectDiff(repo)}
                title="Compare repository files with Google Drive backup"
              >
                🔍 Inspect Diffs
              </button>

              <button
                className="btn btn-amber btn-sm"
                onClick={() => onSync(repo, true)}
                title="Run dry-run scan without uploading"
              >
                🧪 Dry Run
              </button>

              <button
                className="btn btn-emerald btn-sm"
                onClick={() => onSync(repo, false)}
                title="Backup and sync changes to Google Drive"
              >
                🚀 Sync Now
              </button>

              <button
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.3)' }}
                onClick={() => onDeleteRepo(repo.id)}
                title="Delete Repository"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
