import React, { useState } from 'react';

export default function SettingsPage({ state, onSaveConfig, onUploadCredentials }) {
  const gdrive = state?.gdrive || {};
  const [rootFolder, setRootFolder] = useState(gdrive.root_folder_name || 'github');
  const [autoSyncInterval, setAutoSyncInterval] = useState(state?.auto_sync_interval_minutes || 0);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUploadCredentials(e.target.files[0]);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      gdrive: {
        ...gdrive,
        mode: 'service_account',
        root_folder_name: rootFolder
      },
      auto_sync_interval_minutes: parseInt(autoSyncInterval, 10)
    });
    alert('Settings saved successfully!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="material-card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>⚙️ Drive Settings & Configuration</h2>
        <p style={{ fontSize: '0.84rem', color: 'var(--md-text-secondary)' }}>
          Configure Google Drive Service Account authentication and background sync schedules
        </p>
      </div>

      {/* Google Service Account Credentials */}
      <div className="material-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔑</span>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>Google Service Account Credentials</h3>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--md-text-secondary)' }}>
          Upload your GCP Service Account JSON key to enable direct, secure synchronization to Google Drive.
        </p>

        <div style={{ padding: '16px', background: 'var(--md-surface-variant)', border: '1px solid var(--md-border)' }}>
          <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', marginBottom: '8px' }}>
            Upload Service Account JSON Key
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ fontSize: '0.84rem', color: 'var(--md-text-primary)' }}
          />
        </div>

        {/* Root Folder Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: '700' }}>Google Drive Root Shared Folder Name</label>
          <input
            type="text"
            value={rootFolder}
            onChange={(e) => setRootFolder(e.target.value)}
            style={{
              padding: '10px 14px', border: '1px solid var(--md-border)',
              background: 'var(--md-bg)', color: 'var(--md-text-primary)', fontSize: '0.9rem'
            }}
          />
          <span style={{ fontSize: '0.76rem', color: 'var(--md-text-disabled)' }}>
            Folder created and shared in Google Drive (default: github). Backups will nest as github/repo-name/branch/.
          </span>
        </div>

        {/* Auto Sync Interval */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: '700' }}>Background Auto-Sync Interval</label>
          <select
            value={autoSyncInterval}
            onChange={(e) => setAutoSyncInterval(e.target.value)}
            style={{
              padding: '10px 14px', border: '1px solid var(--md-border)',
              background: 'var(--md-bg)', color: 'var(--md-text-primary)', fontSize: '0.9rem'
            }}
          >
            <option value={0}>Disabled (Manual Sync Only)</option>
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 1 hour</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
