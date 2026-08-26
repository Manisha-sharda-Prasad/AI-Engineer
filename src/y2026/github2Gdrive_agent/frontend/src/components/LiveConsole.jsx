import React, { useEffect, useRef } from 'react';

export default function LiveConsole({ job, isOpen = true, onClose, isDrawer = true }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [job?.logs?.length]);

  if (!isOpen || !job) return null;

  const isRunning = job.status === 'running' || job.status === 'queued';
  const progress = job.progress_percent || 0;

  const consoleContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
            📟 Live Execution Console: {job.repo_name} {job.dry_run ? '(Dry Run)' : ''}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--md-text-secondary)' }}>
            Status: <span className={`badge badge-${job.status === 'completed' ? 'synced' : job.status === 'running' ? 'modified' : 'ignored'}`}>
              {job.status.toUpperCase()}
            </span>
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--md-text-secondary)',
              fontSize: '1.5rem', cursor: 'pointer', padding: '4px'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--md-text-secondary)' }}>
          <span>Synced {job.files_synced} of {job.files_total} files</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--md-surface-variant)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: job.status === 'failed' ? 'var(--md-error)' : 'var(--md-primary)',
            transition: 'width 0.3s ease-out'
          }} />
        </div>
      </div>

      {/* Terminal Log Output */}
      <div className="terminal-window" style={{ flex: 1, maxHeight: isDrawer ? 'calc(100vh - 200px)' : '420px' }}>
        {job.logs && job.logs.length > 0 ? (
          job.logs.map((log, index) => (
            <div key={index} className="terminal-line">
              {log}
            </div>
          ))
        ) : (
          <div className="terminal-line" style={{ color: 'var(--md-text-disabled)' }}>
            Initializing sync job logs...
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );

  if (isDrawer) {
    return (
      <div className="drawer-modal-overlay-right" onClick={onClose}>
        <div className="drawer-modal-content-right" onClick={(e) => e.stopPropagation()}>
          {consoleContent}
        </div>
      </div>
    );
  }

  return (
    <div className="material-card" style={{ padding: '24px' }}>
      {consoleContent}
    </div>
  );
}
