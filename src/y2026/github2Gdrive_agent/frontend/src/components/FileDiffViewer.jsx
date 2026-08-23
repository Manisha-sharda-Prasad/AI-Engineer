import React, { useState } from 'react';

export default function FileDiffViewer({ isOpen, onClose, diffData, onSync }) {
  const [filter, setFilter] = useState('all');

  if (!isOpen || !diffData) return null;

  const { repo_name, diffs = [] } = diffData;

  const filteredDiffs = diffs.filter(d => {
    if (filter === 'active') return d.status === 'new' || d.status === 'modified';
    if (filter === 'synced') return d.status === 'synced';
    if (filter === 'ignored') return d.status === 'ignored';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new': return <span className="badge badge-new">NEW</span>;
      case 'modified': return <span className="badge badge-modified">MODIFIED</span>;
      case 'synced': return <span className="badge badge-synced">SYNCED</span>;
      case 'ignored': return <span className="badge badge-ignored">IGNORED</span>;
      default: return <span className="badge badge-ignored">{status}</span>;
    }
  };

  return (
    <div className="drawer-modal-overlay-right" onClick={onClose}>
      <div className="drawer-modal-content-right" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>File Diff Inspector</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)' }}>
              Comparing workspace files vs Google Drive backup for <strong style={{ color: 'var(--md-text-primary)' }}>{repo_name}</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--md-text-secondary)',
              fontSize: '1.5rem', cursor: 'pointer', padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Filter bar & Quick Sync */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'active', 'synced', 'ignored'].map(f => (
              <button
                key={f}
                className={`category-tab ${filter === f ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                onClick={() => setFilter(f)}
              >
                {f.toUpperCase()} ({f === 'all' ? diffs.length : diffs.filter(d => f === 'active' ? (d.status === 'new' || d.status === 'modified') : d.status === f).length})
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-sm" onClick={onSync}>
            Sync Active
          </button>
        </div>

        {/* File Diff Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--md-border)', background: 'var(--md-bg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--md-border)', background: 'var(--md-surface-variant)', color: 'var(--md-text-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Relative Path</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiffs.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: 'var(--md-text-secondary)' }}>
                    No files match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredDiffs.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--md-border)' }}>
                    <td style={{ padding: '8px 12px' }}>{getStatusBadge(d.status)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--md-text-primary)' }}>
                      {d.relative_path}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--md-text-secondary)', textAlign: 'right' }}>
                      {d.size_bytes} B
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
