import React from 'react';

export default function DashboardStats({ state }) {
  const repoCount = state?.repos?.length || 0;
  const history = state?.sync_history || [];
  const completedJobs = history.filter(j => j.status === 'completed');
  
  const totalSyncedFiles = completedJobs.reduce((acc, j) => acc + (j.files_synced || 0), 0);
  const totalBytes = completedJobs.reduce((acc, j) => acc + (j.bytes_transferred || 0), 0);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const autoSyncInterval = state?.auto_sync_interval_minutes || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>ACTIVE REPOSITORIES</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)' }}>{repoCount}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>Local & Remote Repositories</div>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>FILES BACKED UP</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>{totalSyncedFiles}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>Across all sync jobs</div>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>BACKUP STORAGE USED</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>{formatBytes(totalBytes)}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>Target: Google Drive</div>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>AUTO-SYNC SCHEDULE</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: autoSyncInterval > 0 ? '#c084fc' : 'var(--text-dim)' }}>
          {autoSyncInterval > 0 ? `Every ${autoSyncInterval}m` : 'Disabled'}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
          {autoSyncInterval > 0 ? 'Background Auto-sync active' : 'Manual trigger mode'}
        </div>
      </div>
    </div>
  );
}
