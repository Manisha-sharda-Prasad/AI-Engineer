import React, { useState } from 'react';

export default function AddRepoModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('local');
  const [pathOrUrl, setPathOrUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [targetFolder, setTargetFolder] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !pathOrUrl) return;

    onAdd({
      name,
      type,
      path_or_url: pathOrUrl,
      branch: branch || 'main',
      target_folder_name: targetFolder || name
    });

    setName('');
    setPathOrUrl('');
    setBranch('main');
    setTargetFolder('');
    onClose();
  };

  return (
    <div className="drawer-modal-overlay" onClick={onClose}>
      <div className="drawer-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>➕ Add Repository</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)' }}>Connect a local folder or remote GitHub repo</span>
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '8px', color: 'var(--md-text-secondary)' }}>
              Repository Type
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${type === 'local' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setType('local')}
              >
                💻 Local Directory
              </button>
              <button
                type="button"
                className={`btn ${type === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setType('remote')}
              >
                🌐 Remote GitHub
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', color: 'var(--md-text-secondary)' }}>
              Repository Display Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. solution-engineer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                color: 'var(--md-text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.9rem'
              }}

            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', color: 'var(--md-text-secondary)' }}>
              {type === 'local' ? 'Local Directory Path' : 'GitHub Repository Slug / URL'}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'local' ? 'C:\\projects\\my-app' : 'octocat/Hello-World'}
              value={pathOrUrl}
              onChange={(e) => setPathOrUrl(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                color: 'var(--md-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', color: 'var(--md-text-secondary)' }}>
              Branch Name
            </label>
            <input
              type="text"
              value={branch}
              placeholder="main"
              onChange={(e) => setBranch(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                color: 'var(--md-text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--md-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              Save Repository
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
