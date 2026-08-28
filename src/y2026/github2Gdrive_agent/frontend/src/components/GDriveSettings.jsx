import React, { useState } from 'react';

export default function GDriveSettings({ isOpen, onClose, state, onSaveConfig, onUploadCredentials }) {
  const gdrive = state?.gdrive || {};
  const [rootFolderName, setRootFolderName] = useState(gdrive.root_folder_name || 'github');
  const [autoSyncInterval, setAutoSyncInterval] = useState(state?.auto_sync_interval_minutes || 0);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveConfig({
      gdrive: {
        ...gdrive,
        mode: 'service_account',
        root_folder_name: rootFolderName
      },
      auto_sync_interval_minutes: parseInt(autoSyncInterval, 10)
    });
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadCredentials(file);
    }
  };

  return (
    <div className="drawer-modal-overlay" onClick={onClose}>
      <div className="drawer-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>🔑 Google Drive API Settings</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)' }}>Configure Google Service Account credentials & sync schedule</span>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, marginTop: '14px' }}>
          {/* Service Account Credentials Card */}
          <div style={{ padding: '16px', background: 'var(--md-surface-variant)', border: '1px solid var(--md-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>🔑</span>
              <h4 style={{ fontSize: '0.92rem', fontWeight: '800' }}>Google Service Account Credentials</h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)' }}>
              Upload your GCP Service Account JSON key to enable direct synchronization to Google Drive.
            </p>
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ fontSize: '0.82rem', color: 'var(--md-text-primary)', marginTop: '4px' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', color: 'var(--md-text-secondary)' }}>
              Root Google Drive Shared Folder
            </label>
            <input
              type="text"
              value={rootFolderName}
              onChange={(e) => setRootFolderName(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                color: 'var(--md-text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.9rem'
              }}
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--md-text-disabled)', marginTop: '4px', display: 'block' }}>
              Root shared folder in Google Drive (default: github). Backups will nest as github/repo-name/branch/.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', color: 'var(--md-text-secondary)' }}>
              Background Auto-Sync Schedule
            </label>
            <select
              value={autoSyncInterval}
              onChange={(e) => setAutoSyncInterval(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                color: 'var(--md-text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.88rem'
              }}
            >
              <option value={0}>Disabled (Manual Sync Only)</option>
              <option value={5}>Every 5 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every 1 hour</option>
            </select>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--md-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
