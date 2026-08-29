import React from 'react'

export default function ReferencesSection({
  headingTitle = 'References',
  headingId = 'references',
  rawContent = '',
  items = [],
  groups = [],
  onOpenLink,
}) {
  // Default container to collapsed as requested
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('all')

  // Normalize groups
  const allGroups = React.useMemo(() => {
    if (groups && groups.length > 0) return groups
    if (items && items.length > 0) return [{ name: 'General', items }]
    return []
  }, [groups, items])

  const allItems = React.useMemo(() => {
    const list = []
    for (const g of allGroups) {
      for (const item of g.items) {
        list.push(item)
      }
    }
    return list
  }, [allGroups])

  const displayedItems = React.useMemo(() => {
    if (activeTab === 'all') return allItems
    const group = allGroups.find(g => g.name.toLowerCase() === activeTab.toLowerCase())
    return group ? group.items : allItems
  }, [activeTab, allGroups, allItems])

  const handleCopyAll = async (e) => {
    e.stopPropagation()
    try {
      let textToCopy = ''
      if (allGroups.length > 1 && activeTab === 'all') {
        textToCopy = allGroups.map(g => {
          const groupHeader = `### ${g.name}`
          const groupLinks = g.items
            .map(item => item.url ? `- [${item.title || item.url}](${item.url})` : `- ${item.title}`)
            .join('\n')
          return `${groupHeader}\n${groupLinks}`
        }).join('\n\n')
      } else {
        textToCopy = displayedItems
          .map(item => item.url ? `- [${item.title || item.url}](${item.url})` : `- ${item.title}`)
          .join('\n')
      }

      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const cleanTitle = headingTitle.replace(/^#+\s*/, '').replace(/^[📚🔗\s]+/, '').trim() || 'References'
  const hasMultipleGroups = allGroups.length > 1

  return (
    <div id={headingId} className="notes-references-card">
      <div
        className="notes-references-header"
        onClick={() => setIsExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(prev => !prev)
          }
        }}
      >
        <div className="notes-references-title-group">
          <span className="notes-references-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
              <path d="M6 6h10M6 10h10M6 14h6"/>
            </svg>
          </span>
          <h2 className="notes-references-heading">{cleanTitle}</h2>
          {allItems.length > 0 && (
            <span className="notes-references-count-badge">
              {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <div className="notes-references-actions" onClick={e => e.stopPropagation()}>
          {allItems.length > 0 && (
            <button
              type="button"
              className={`notes-references-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyAll}
              title={copied ? 'Copied references!' : 'Copy references'}
              aria-label={copied ? 'Copied references' : 'Copy references to clipboard'}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4 10 4 4 8-8"/>
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy All</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="notes-references-toggle-btn"
            onClick={() => setIsExpanded(prev => !prev)}
            aria-label={isExpanded ? 'Collapse references' : 'Expand references'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`notes-references-chevron ${isExpanded ? 'is-open' : ''}`}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="notes-references-body">
          {hasMultipleGroups && (
            <div className="notes-references-tabs" role="tablist" aria-label="Reference categories">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`notes-references-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>All</span>
                <span className="tab-count">{allItems.length}</span>
              </button>
              {allGroups.map(group => (
                <button
                  key={group.name}
                  type="button"
                  role="tab"
                  aria-selected={activeTab.toLowerCase() === group.name.toLowerCase()}
                  className={`notes-references-tab-btn ${activeTab.toLowerCase() === group.name.toLowerCase() ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(group.name.toLowerCase())}
                >
                  <span>{group.name}</span>
                  <span className="tab-count">{group.items.length}</span>
                </button>
              ))}
            </div>
          )}

          {displayedItems.length > 0 ? (
            <div className="notes-references-grid">
              {displayedItems.map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  className={`notes-reference-item-card link-type-${item.descriptor?.type || 'external'}`}
                  onClick={(e) => {
                    if (onOpenLink && item.descriptor) {
                      e.preventDefault()
                      onOpenLink(item.descriptor)
                    }
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="notes-reference-item-icon">
                    <ReferenceBrandIcon type={item.descriptor?.type} />
                  </div>
                  <div className="notes-reference-item-content">
                    <strong className="notes-reference-item-title">{item.title}</strong>
                    {item.hostname && (
                      <span className="notes-reference-item-domain">{item.hostname}</span>
                    )}
                  </div>
                  <div className="notes-reference-item-action" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="notes-references-empty">No references in this category.</div>
          )}

          {rawContent && (
            <div className="notes-references-notes">
              {rawContent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReferenceBrandIcon({ type }) {
  if (type === 'youtube' || type === 'youtube-post') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8 0-2-.2-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/>
      </svg>
    )
  }
  if (type === 'github') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M12 2A10 10 0 0 0 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7 0-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.8 9.8 0 0 1 5.2 0c2-1.4 2.8-1.1 2.8-1.1.5 1.4.2 2.4.1 2.7.7.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2Z"/>
      </svg>
    )
  }
  if (type === 'chatgpt') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    )
  }
  if (type === 'excalidraw') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="6" width="16" height="12" rx="2"/>
        <path d="M5 14l3-5 3 3 3-4 3 6M18 2l4 4-6 6-2.5.5.5-2.5z"/>
      </svg>
    )
  }
  if (type === 'note' || type === 'folder') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"/>
    </svg>
  )
}
