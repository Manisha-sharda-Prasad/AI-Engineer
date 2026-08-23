import React, { useState } from 'react';
import FileTreeExplorer from './FileTreeExplorer.jsx';
import FileDiffViewer from './FileDiffViewer.jsx';
import LiveConsole from './LiveConsole.jsx';
import GDriveSettings from './GDriveSettings.jsx';

// Reusable Circular Character Avatar Icon
const CharAvatar = ({ text, size = 20, bg = 'var(--md-primary-container)', color = 'var(--md-primary)' }) => {
  const char = (text || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="circular-avatar"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: bg, color: color, fontSize: '0.7rem', fontWeight: '700',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, textTransform: 'uppercase'
      }}
    >
      {char}
    </div>
  );
};

// SVG Icons
const IconPlay = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconFlask = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 3h6M10 9V3M14 9V3M6 20h12a2 2 0 0 0 1.9-2.6L15 9H9l-4.9 8.4A2 2 0 0 0 6 20z" />
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconTerminal = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function ReposPage({
  state,
  selectedRepoId,
  onSelectRepo,
  onTriggerSync,
  onDeleteRepo,
  onSaveSettings,
  onUploadCredentials,
  activeDiffData,
  loadingDiff,
  activeJob
}) {
  const repos = state?.repos || [];
  const selectedRepo = repos.find(r => r.id === selectedRepoId) || repos[0];
  const gdrive = state?.gdrive || {};
  const isDriveConnected = !!gdrive.connected;

  const [isDiffDrawerOpen, setIsDiffDrawerOpen] = useState(false);
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState(false);
  const [isDriveSettingsOpen, setIsDriveSettingsOpen] = useState(false);

  if (!selectedRepo) {
    return (
      <div className="material-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--md-text-secondary)' }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '12px', fontWeight: '700' }}>No Repository Selected</p>
        <p style={{ fontSize: '0.88rem' }}>Click "+ Add Repo" in the side navigation bar to connect a project.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pinned Flush Sticky Top Panel */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'var(--md-bg)',
          marginTop: '-16px', marginLeft: '-28px', marginRight: '-28px',
          paddingTop: '16px', paddingBottom: '12px',
          paddingLeft: '28px', paddingRight: '28px',
          borderBottom: '1px solid var(--md-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        {/* Repository Selector Chips */}
        {repos.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
            {repos.map(r => (
              <button
                key={r.id}
                className={`btn btn-sm ${r.id === selectedRepo.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onSelectRepo(r.id)}
              >
                <CharAvatar text={r.name} size={18} bg={r.id === selectedRepo.id ? 'white' : 'var(--md-primary-container)'} color="var(--md-primary)" />
                <span>{r.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Repository Detail Header Card */}
        <div className="material-card repo-header-card" style={{ padding: '16px 20px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <CharAvatar text={selectedRepo.name} size={28} />
                <span className={`badge ${selectedRepo.type === 'local' ? 'badge-local' : 'badge-remote'}`}>
                  {selectedRepo.type === 'local' ? 'LOCAL' : 'GITHUB'}
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{selectedRepo.name}</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--md-text-disabled)' }}>branch: {selectedRepo.branch || 'main'}</span>

                {/* Google Drive Connection Indicator (Green / Yellow) */}
                <button
                  onClick={() => setIsDriveSettingsOpen(true)}
                  style={{
                    background: isDriveConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: isDriveConnected ? '#22c55e' : '#eab308',
                    border: `1px solid ${isDriveConnected ? 'rgba(34, 197, 94, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`,
                    borderRadius: '12px', padding: '2px 9px', fontSize: '0.74rem', fontWeight: '700',
                    display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer'
                  }}
                  title={isDriveConnected ? "Google Drive Configured & Connected" : "Google Service Account Credentials Missing - Click to Configure"}
                >
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: isDriveConnected ? '#22c55e' : '#eab308',
                    boxShadow: isDriveConnected ? '0 0 6px #22c55e' : '0 0 6px #eab308'
                  }} />
                  {isDriveConnected ? 'GDRIVE CONNECTED' : 'GDRIVE UNCONFIGURED'}
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--md-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {selectedRepo.path_or_url}
              </p>

              <div style={{ fontSize: '0.76rem', color: 'var(--md-text-disabled)', marginTop: '4px' }}>
                Google Drive Location: <strong style={{ color: 'var(--md-text-primary)' }}>github/{selectedRepo.name}/{selectedRepo.branch || 'main'}</strong>
              </div>
            </div>

            {/* Combined Compact Action Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--md-surface-variant)', padding: '4px', border: '1px solid var(--md-border)', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onTriggerSync(selectedRepo.id, true)} title="Dry Run All Files">
                <IconFlask />
                <span>Dry Run</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => onTriggerSync(selectedRepo.id, false)} title="Sync All Files">
                <IconPlay />
                <span>Full Sync</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsDiffDrawerOpen(true)} title="Inspect File Diff Drawer Table">
                <IconSearch />
                <span>Diff Table</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsConsoleDrawerOpen(true)} title="Open Live Console Drawer">
                <IconTerminal />
                <span>Live Console</span>
              </button>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--md-error)' }} onClick={() => onDeleteRepo(selectedRepo.id)} title="Delete Repository">
                <IconTrash />
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner if Google Service Account is Not Configured */}
        {!isDriveConnected && (
          <div
            style={{
              marginTop: '10px', padding: '10px 16px',
              background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
            }}
          >
            <div>
              <strong style={{ color: '#eab308', fontSize: '0.84rem' }}>⚠️ Google Service Account Key Missing</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)', marginTop: '2px' }}>
                Google Service Account mode is required for syncing. Please upload your Service Account JSON key.
              </p>
            </div>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => setIsDriveSettingsOpen(true)}
              style={{ fontWeight: '700', padding: '5px 12px', flexShrink: 0 }}
            >
              ⚙️ Configure Key
            </button>
          </div>
        )}
      </div>

      {/* Main Directory File Explorer View */}
      {loadingDiff ? (
        <div className="material-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--md-text-secondary)' }}>
          Scanning repository files & diffs...
        </div>
      ) : (
        <FileTreeExplorer
          diffs={activeDiffData?.diffs || []}
          onSyncSelected={(selectedFiles, dryRun) => onTriggerSync(selectedRepo.id, dryRun, selectedFiles)}
        />
      )}

      {/* Right Side Drawer Modals */}
      <FileDiffViewer
        isOpen={isDiffDrawerOpen}
        onClose={() => setIsDiffDrawerOpen(false)}
        diffData={activeDiffData}
        onSync={() => {
          setIsDiffDrawerOpen(false);
          onTriggerSync(selectedRepo.id, false);
        }}
      />

      <LiveConsole
        job={activeJob}
        isOpen={isConsoleDrawerOpen}
        onClose={() => setIsConsoleDrawerOpen(false)}
        isDrawer={true}
      />

      <GDriveSettings
        isOpen={isDriveSettingsOpen}
        onClose={() => setIsDriveSettingsOpen(false)}
        state={state}
        onSaveConfig={onSaveSettings}
        onUploadCredentials={onUploadCredentials}
      />
    </div>
  );
}
