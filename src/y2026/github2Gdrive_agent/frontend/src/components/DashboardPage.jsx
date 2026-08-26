import React from 'react';
import DashboardStats from './DashboardStats.jsx';

export default function DashboardPage({ state, onNavigateToRepo, onTriggerSync, onOpenAddRepo }) {
  const repos = state?.repos || [];
  const history = state?.sync_history || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Welcome Header */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>🏠 Dashboard Overview</h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            Monitor local & remote GitHub backups to Google Drive
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenAddRepo}>
          ➕ Add Repository
        </button>
      </div>

      {/* Metrics Row */}
      <DashboardStats state={state} />

      {/* Repositories Summary Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Connected Repositories ({repos.length})</h3>

        {repos.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No repositories configured yet.<br />Click "+ Add Repository" to get started.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {repos.map(repo => (
              <div key={repo.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{repo.name}</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>branch: {repo.branch || 'main'}</span>
                  </div>
                  <span className={`badge ${repo.type === 'local' ? 'badge-local' : 'badge-remote'}`}>
                    {repo.type === 'local' ? 'LOCAL' : 'REMOTE'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.path_or_url}
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                  Target: <span style={{ color: 'var(--text-main)' }}>github/{repo.name}/{repo.branch || 'main'}</span>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onNavigateToRepo(repo.id)}>
                    🔍 View Detail
                  </button>
                  <button className="btn btn-emerald btn-sm" onClick={() => onTriggerSync(repo.id, false)}>
                    🚀 Sync Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Log Table */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Recent Sync Activity History</h3>

        {history.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No recent sync activity logs recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Job ID</th>
                  <th style={{ padding: '10px' }}>Repository</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Files Synced</th>
                  <th style={{ padding: '10px' }}>Data Transferred</th>
                  <th style={{ padding: '10px' }}>Started At</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map(job => (
                  <tr key={job.job_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{job.job_id}</td>
                    <td style={{ padding: '10px', fontWeight: '600' }}>{job.repo_name}</td>
                    <td style={{ padding: '10px' }}>
                      <span className={`badge badge-${job.status === 'completed' ? 'synced' : job.status === 'running' ? 'modified' : 'ignored'}`}>
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>{job.files_synced} / {job.files_total}</td>
                    <td style={{ padding: '10px' }}>{(job.bytes_transferred / (1024 * 1024)).toFixed(2)} MB</td>
                    <td style={{ padding: '10px', color: 'var(--text-dim)' }}>
                      {job.started_at ? new Date(job.started_at).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
