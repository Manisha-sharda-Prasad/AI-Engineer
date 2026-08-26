import React from 'react';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'btn-primary',
  onConfirm,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        className="material-card"
        style={{
          width: '460px', maxWidth: '92vw', padding: '24px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--md-text-primary)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--md-text-secondary)',
              fontSize: '1.4rem', cursor: 'pointer', padding: '2px'
            }}
          >
            ×
          </button>
        </div>

        {/* Message Body */}
        <p style={{ fontSize: '0.88rem', color: 'var(--md-text-secondary)', lineHeight: '1.5' }}>
          {message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${confirmVariant} btn-sm`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
