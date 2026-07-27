import React from 'react'
import { CloseIcon } from './Icons'

export default function DismissibleError({ children, message, className = '' }) {
  const content = message ?? children
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    setDismissed(false)
  }, [content])

  if (!content || dismissed) return null

  return (
    <div className={`alert alert-error dismissible-error ${className}`.trim()} role="alert">
      <span>{content}</span>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss error" title="Dismiss error"><CloseIcon /></button>
    </div>
  )
}
