import React from 'react'

export default function LoadingBar({ active, label = 'Loading…', className = '' }) {
  if (!active) return null

  return <div className={`loading-wait-bar ${className}`.trim()} role="status" aria-live="polite">
    <span className="loading-wait-track" aria-hidden="true"><span /></span>
    <span className="loading-wait-label">{label}</span>
  </div>
}
