import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams } from 'react-router-dom'

import DismissibleError from '../components/DismissibleError'
import { getNoteContent, getNoteRepositories, getNotes } from '../api/githubNotes'

let mermaidRenderSequence = 0

function relativeUrl(value, rawUrl) {
  if (!value || !rawUrl || /^(?:[a-z]+:|#|\/\/)/i.test(value)) return value
  try { return new URL(value, rawUrl).toString() } catch { return value }
}

function displayName(value = '') {
  return value.replace(/^\d+[_. -]*/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function relativeParts(path, rootPath) {
  const prefix = rootPath ? `${rootPath.replace(/\/$/, '')}/` : ''
  return (path.startsWith(prefix) ? path.slice(prefix.length) : path).split('/')
}

function taxonomy(note, rootPath) {
  const parts = relativeParts(note.path, rootPath)
  return { year: parts.length > 1 ? parts[0] : 'Notes', topic: parts.length > 2 ? parts[1] : 'General' }
}

function buildTree(notes, prefixPath) {
  const root = { path: '', directories: new Map(), notes: [] }
  const prefix = prefixPath ? `${prefixPath.replace(/\/$/, '')}/` : ''
  for (const note of notes) {
    const relative = note.path.startsWith(prefix) ? note.path.slice(prefix.length) : note.path
    const parts = relative.split('/')
    let cursor = root
    for (const segment of parts.slice(0, -1)) {
      const path = cursor.path ? `${cursor.path}/${segment}` : segment
      if (!cursor.directories.has(segment)) cursor.directories.set(segment, { name: segment, path, directories: new Map(), notes: [] })
      cursor = cursor.directories.get(segment)
    }
    cursor.notes.push(note)
  }
  return root
}

function noteCount(node) {
  return node.notes.length + [...node.directories.values()].reduce((total, child) => total + noteCount(child), 0)
}

function directoryPaths(node) {
  return [...node.directories.values()].flatMap(child => [child.path, ...directoryPaths(child)])
}

function cleanHeading(value) {
  return value.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~<>]/g, '').trim()
}

function slug(value) {
  return cleanHeading(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-') || 'section'
}

function extractHeadings(markdown = '') {
  const withoutCode = markdown.replace(/^```[\s\S]*?^```/gm, '')
  const counts = {}
  return [...withoutCode.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map(match => {
    const title = cleanHeading(match[2])
    const base = slug(title)
    counts[base] = (counts[base] || 0) + 1
    return { level: match[1].length, title, id: counts[base] === 1 ? base : `${base}-${counts[base]}` }
  })
}

function MermaidDiagram({ source }) {
  const containerRef = React.useRef(null)
  const diagramId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [error, setError] = React.useState('')
  const [showDialog, setShowDialog] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)
  const [theme, setTheme] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'light')

  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.getAttribute('data-theme') || 'light'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    let active = true
    setError('')
    const renderDiagram = async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        if (!active) return
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default' })
        mermaidRenderSequence += 1
        const { svg, bindFunctions } = await mermaid.render(`notes-mermaid-${diagramId}-${mermaidRenderSequence}`, source)
        if (!active || !containerRef.current) return
        containerRef.current.innerHTML = svg
        bindFunctions?.(containerRef.current)
      } catch (renderError) {
        if (active) setError(renderError?.message || 'Unable to render this Mermaid diagram.')
      }
    }
    renderDiagram()
    return () => { active = false }
  }, [diagramId, source, theme])

  React.useEffect(() => {
    if (!showDialog) return undefined
    const close = event => { if (event.key === 'Escape') setShowDialog(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [showDialog])

  if (error) return <div className="mermaid-error"><strong>Mermaid diagram error</strong><span>{error}</span><pre><code>{source}</code></pre></div>
  return <div className="mermaid-card">
    <div className="mermaid-toolbar"><span>Interactive diagram</span><button type="button" onClick={() => { setZoom(1); setShowDialog(true) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>Full screen</button></div>
    <div className="mermaid-diagram" ref={containerRef} aria-label="Mermaid diagram" />
    {showDialog && <div className="mermaid-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowDialog(false) }}><section className="mermaid-dialog" role="dialog" aria-modal="true" aria-label="Full-screen Mermaid diagram">
      <header><div><span>Diagram viewer</span><strong>Use the controls to zoom and inspect the diagram.</strong></div><div className="mermaid-zoom-controls"><button type="button" onClick={() => setZoom(value => Math.max(0.35, value - 0.15))} aria-label="Zoom out">−</button><button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button type="button" onClick={() => setZoom(value => Math.min(2.5, value + 0.15))} aria-label="Zoom in">+</button><button type="button" className="mermaid-dialog-close" onClick={() => setShowDialog(false)} aria-label="Close diagram">×</button></div></header>
      <div className="mermaid-dialog-stage"><div className="mermaid-dialog-canvas" style={{ width: `${zoom * 100}%` }} dangerouslySetInnerHTML={{ __html: containerRef.current?.innerHTML || '' }} /></div>
    </section></div>}
  </div>
}

function Breadcrumbs({ index, selectedPath, onDirectory }) {
  if (!index || !selectedPath) return null
  const parts = relativeParts(selectedPath, index.root_path)
  const directories = parts.slice(0, -1)
  return (
    <nav className="notes-breadcrumbs" aria-label="Note breadcrumb">
      {directories.map((part, position) => (
        <React.Fragment key={`${position}-${part}`}>
          {position > 0 && <span aria-hidden="true">›</span>}
          <button type="button" onClick={() => onDirectory(directories.slice(0, position + 1))}>{displayName(part)}</button>
        </React.Fragment>
      ))}
      {directories.length > 0 && <span aria-hidden="true">›</span>}
      <strong>{displayName(parts.at(-1).replace(/\.(md|markdown)$/i, ''))}</strong>
    </nav>
  )
}

function NoteTree({ node, selectedPath, expanded, onToggle, onSelect, depth = 0 }) {
  const directories = [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const notes = [...node.notes].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
  return <div className="notes-tree-level" style={{ '--tree-depth': depth }}>
    {directories.map(directory => {
      const isExpanded = expanded[directory.path] !== false
      return <div className="notes-tree-directory" key={directory.path}>
        <button type="button" className="notes-tree-folder" data-tree-path={directory.path} onClick={() => onToggle(directory.path)} aria-expanded={isExpanded}>
          <span className={`notes-tree-chevron ${isExpanded ? 'expanded' : ''}`}>›</span>
          <span className="notes-tree-folder-name">{displayName(directory.name)}</span>
          <small className="notes-count-badge">{noteCount(directory)}</small>
        </button>
        <div className={`notes-tree-children ${isExpanded ? 'expanded' : ''}`}><div><NoteTree node={directory} selectedPath={selectedPath} expanded={expanded} onToggle={onToggle} onSelect={onSelect} depth={depth + 1} /></div></div>
      </div>
    })}
    {notes.map(note => <button type="button" key={note.path} className={`notes-tree-note ${selectedPath === note.path ? 'active' : ''}`} onClick={() => onSelect(note.path)} title={note.path}><span className="notes-file-icon">#</span><strong>{note.title}</strong></button>)}
  </div>
}

function MarkdownContent({ note, headings }) {
  let headingIndex = 0
  const heading = level => ({ children, ...props }) => {
    const Tag = `h${level}`
    const id = headings[headingIndex]?.id
    headingIndex += 1
    return <Tag id={id} {...props}>{children}</Tag>
  }
  const components = {
    a: ({ href, children, ...props }) => <a href={relativeUrl(href, note.raw_url)} target="_blank" rel="noreferrer" {...props}>{children}</a>,
    img: ({ src, alt, ...props }) => <img src={relativeUrl(src, note.raw_url)} alt={alt || ''} loading="lazy" {...props} />,
    h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4), h5: heading(5), h6: heading(6),
    pre: ({ children, ...props }) => {
      const codeElement = React.Children.count(children) === 1 ? React.Children.only(children) : null
      const language = /language-([^\s]+)/.exec(codeElement?.props?.className || '')?.[1]?.toLowerCase()
      if (language === 'mermaid') return <MermaidDiagram source={String(codeElement.props.children).replace(/\n$/, '')} />
      return <pre {...props}>{children}</pre>
    },
  }
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{note.content}</ReactMarkdown>
}

function OnThisPage({ note, headings, activeHeading }) {
  const [query, setQuery] = React.useState('')
  React.useEffect(() => setQuery(''), [note?.path])
  const normalizedQuery = query.trim().toLowerCase()
  const visibleHeadings = headings.filter(item => !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery))
  return <aside className="notes-outline" aria-label="On this page">
    <div className="notes-outline-sticky">
      <span>On this page</span>
      <strong>{note?.title || 'Note outline'}</strong>
      <label className="notes-outline-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a heading…" aria-label="Search headings in this note"/></label>
      {visibleHeadings.length ? <nav>{visibleHeadings.map(item => <button type="button" key={item.id} className={`${item.level > 2 ? 'subheading' : ''} ${activeHeading === item.id ? 'active' : ''}`} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.title}</button>)}</nav> : <p>{headings.length ? 'No headings match your search.' : 'No headings in this note.'}</p>}
    </div>
  </aside>
}

const REPOSITORY_COLORS = {
  'senior-system-engineer': ['#7c3aed', '#ec4899'],
  'ai-engineer': ['#0891b2', '#6366f1'],
  'microservice-java': ['#ea580c', '#ef4444'],
  'microservice-python': ['#0284c7', '#eab308'],
}

function repositoryStyle(repositoryId) {
  const [accent, secondary] = REPOSITORY_COLORS[repositoryId] || ['#73553f', '#d97706']
  return { '--notes-accent': accent, '--notes-accent-2': secondary, '--notes-glow': `${accent}2e` }
}

function RepositoryMark({ repositoryId, className = '' }) {
  const gradientId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return <svg className={`notes-repository-mark ${className}`} viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="8" y1="7" x2="57" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor="var(--notes-accent)"/><stop offset="1" stopColor="var(--notes-accent-2)"/></linearGradient></defs>
    <rect x="3" y="3" width="58" height="58" rx="17" fill={`url(#${gradientId})`}/>
    <path d="M17 17h22a8 8 0 0 1 8 8v24H23a6 6 0 0 1-6-6V17Z" fill="none" stroke="white" strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M23 17v26a6 6 0 0 0-6-6m12-11h11M29 33h11M29 40h7" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
    {repositoryId === 'ai-engineer' && <><circle cx="45" cy="18" r="5" fill="#fff"/><path d="m41.5 21.5-5 5" stroke="#fff" strokeWidth="2.5"/></>}
    {repositoryId === 'microservice-java' && <path d="M43 45c5 0 7-3 7-6-3 0-5 1-7 3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>}
    {repositoryId === 'microservice-python' && <path d="m39 21 5 4-5 4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
}

function RepositoryDropdown({ repositories, selected, onSelect }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const pickerRef = React.useRef(null)
  React.useEffect(() => {
    const close = event => { if (!pickerRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const visible = repositories.filter(repository => `${repository.name} ${repository.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  const choose = repository => { onSelect(repository.id); setOpen(false); setQuery('') }
  return <div className="notes-repository-picker" ref={pickerRef}>
    <button type="button" className="notes-repository-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <RepositoryMark repositoryId={selected?.id}/><span><b>{selected?.name || 'Choose repository'}</b><small>{selected?.description || 'Select a learning-notes repository'}</small></span><svg className="notes-picker-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
    </button>
    {open && <div className="notes-repository-menu" role="menu" aria-label="Switch notes repository">
      <strong>Switch learning notes</strong>
      <label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search repositories…"/></label>
      <div className="notes-repository-menu-list">{visible.map(repository => <button type="button" role="menuitem" style={repositoryStyle(repository.id)} className={repository.id === selected?.id ? 'active' : ''} key={repository.id} onClick={() => choose(repository)}><span className="notes-repository-check">{repository.id === selected?.id ? '✓' : ''}</span><RepositoryMark repositoryId={repository.id}/><span><b>{repository.name}</b><small>{repository.description}</small><em>{repository.note_count} notes · {repository.branch}/{repository.root_path}</em></span></button>)}{!visible.length && <p>No repositories match your search.</p>}</div>
    </div>}
  </div>
}

function RepositoryCards({ repositories, loading, onOpen }) {
  return <div className="notes-catalog"><header className="notes-page-header"><div><span className="notes-eyebrow">Your knowledge library</span><h1>Learning notes</h1><p>Choose a configured GitHub repository to explore its topics and notes.</p></div></header>{loading ? <div className="note-reader-status"><span className="spinner" /> Loading repositories…</div> : <div className="notes-repository-grid">{repositories.map(repository => <button type="button" style={repositoryStyle(repository.id)} className="notes-repository-card" key={repository.id} onClick={() => !repository.error && onOpen(repository.id)} disabled={Boolean(repository.error)}><RepositoryMark repositoryId={repository.id}/><span className="notes-repository-copy"><strong>{repository.name}</strong><span>{repository.description}</span><small>{repository.error || `${repository.note_count} notes · ${repository.branch} / ${repository.root_path}`}</small></span><span className="notes-card-arrow">›</span></button>)}</div>}</div>
}

export default function Notes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const repositoryId = searchParams.get('repo') || ''
  const selectedPath = searchParams.get('path') || ''
  const [repositories, setRepositories] = React.useState([])
  const navigationRef = React.useRef(null)
  const [index, setIndex] = React.useState(null)
  const [note, setNote] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState({})
  const [showNavigation, setShowNavigation] = React.useState(true)
  const [activeHeading, setActiveHeading] = React.useState('')
  const [loadingCatalog, setLoadingCatalog] = React.useState(true)
  const [loadingIndex, setLoadingIndex] = React.useState(false)
  const [loadingNote, setLoadingNote] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    getNoteRepositories().then(data => active && setRepositories(data.repositories || [])).catch(fetchError => active && setError(fetchError.message || 'Unable to load note repositories.')).finally(() => active && setLoadingCatalog(false))
    return () => { active = false }
  }, [])

  React.useEffect(() => {
    if (!repositoryId) return undefined
    document.body.classList.add('notes-reader-open')
    return () => document.body.classList.remove('notes-reader-open')
  }, [repositoryId])

  React.useEffect(() => {
    if (navigationRef.current) navigationRef.current.inert = !showNavigation
  }, [showNavigation])

  React.useEffect(() => {
    if (!repositoryId) { setIndex(null); setNote(null); return undefined }
    let active = true
    setLoadingIndex(true); setError(''); setQuery('')
    getNotes(repositoryId).then(data => { if (!active) return; setIndex(data); if (!selectedPath && data.notes?.length) setSearchParams({ repo: repositoryId, path: data.notes[0].path }, { replace: true }) }).catch(fetchError => active && setError(fetchError.message || 'Unable to load this repository.')).finally(() => active && setLoadingIndex(false))
    return () => { active = false }
  }, [repositoryId])

  React.useEffect(() => {
    if (!repositoryId || !selectedPath) { setNote(null); return undefined }
    let active = true
    setLoadingNote(true); setError('')
    getNoteContent(repositoryId, selectedPath).then(data => active && setNote(data)).catch(fetchError => { if (active) { setNote(null); setError(fetchError.message || 'Unable to load this note.') } }).finally(() => active && setLoadingNote(false))
    return () => { active = false }
  }, [repositoryId, selectedPath])

  const allNotes = index?.notes || []
  const currentTaxonomy = selectedPath ? taxonomy({ path: selectedPath }, index?.root_path || '') : { year: '', topic: '' }
  const years = [...new Set(allNotes.map(item => taxonomy(item, index?.root_path || '').year))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const selectedYear = years.includes(currentTaxonomy.year) ? currentTaxonomy.year : years[0]
  const yearNotes = allNotes.filter(item => taxonomy(item, index?.root_path || '').year === selectedYear)
  const topics = [...new Set(yearNotes.map(item => taxonomy(item, index?.root_path || '').topic))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const selectedTopic = topics.includes(currentTaxonomy.topic) ? currentTaxonomy.topic : topics[0]
  const normalizedQuery = query.trim().toLowerCase()
  const filteredNotes = allNotes.filter(item => !normalizedQuery || `${item.title} ${item.path}`.toLowerCase().includes(normalizedQuery))
  const topicNotes = filteredNotes.filter(item => { const value = taxonomy(item, index?.root_path || ''); return value.year === selectedYear && value.topic === selectedTopic })
  const topicPrefix = [index?.root_path, selectedYear !== 'Notes' ? selectedYear : '', selectedTopic !== 'General' ? selectedTopic : ''].filter(Boolean).join('/')
  const tree = React.useMemo(() => buildTree(topicNotes, topicPrefix), [topicNotes, topicPrefix])
  const headings = React.useMemo(() => extractHeadings(note?.content), [note?.content])

  React.useEffect(() => {
    setActiveHeading(headings[0]?.id || '')
    if (!headings.length) return undefined
    const observer = new IntersectionObserver(entries => { const visible = entries.find(entry => entry.isIntersecting); if (visible) setActiveHeading(visible.target.id) }, { rootMargin: '-15% 0px -70% 0px' })
    const timeout = window.setTimeout(() => headings.forEach(item => { const element = document.getElementById(item.id); if (element) observer.observe(element) }), 0)
    return () => { window.clearTimeout(timeout); observer.disconnect() }
  }, [headings])

  const selectNote = path => setSearchParams({ repo: repositoryId, path })
  const chooseFirst = candidates => { if (candidates.length) selectNote([...candidates].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))[0].path) }
  const selectYear = year => chooseFirst(allNotes.filter(item => taxonomy(item, index.root_path).year === year))
  const selectTopic = topic => chooseFirst(yearNotes.filter(item => taxonomy(item, index.root_path).topic === topic))
  const navigateBreadcrumb = parts => {
    if (parts.length === 1) return selectYear(parts[0])
    if (parts.length === 2) return selectTopic(parts[1])
    const directoryPath = parts.slice(2).join('/')
    const segments = directoryPath.split('/')
    setExpanded(current => ({ ...current, ...Object.fromEntries(segments.map((_, position) => [segments.slice(0, position + 1).join('/'), true])) }))
    window.requestAnimationFrame(() => { const target = [...document.querySelectorAll('[data-tree-path]')].find(element => element.dataset.treePath === directoryPath); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); target?.focus({ preventScroll: true }) })
  }

  if (!repositoryId) return <RepositoryCards repositories={repositories} loading={loadingCatalog} onOpen={repo => setSearchParams({ repo })} />

  const currentRepository = repositories.find(item => item.id === repositoryId)
  const allTreePaths = directoryPaths(tree)
  const allExpanded = allTreePaths.every(path => expanded[path] !== false)

  return <div className={`notes-page ${showNavigation ? '' : 'navigation-hidden'}`} style={repositoryStyle(repositoryId)}>
    <header className="notes-reader-header">
      <div className="notes-repository-switcher"><RepositoryDropdown repositories={repositories} selected={currentRepository || index} onSelect={repo => setSearchParams({ repo })}/></div>
      <div className="notes-header-actions"><button type="button" className="notes-nav-toggle" onClick={() => setShowNavigation(current => !current)} aria-expanded={showNavigation} aria-controls="notes-topic-navigation" title={`${showNavigation ? 'Hide' : 'Show'} topic navigation`}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M6 8h0M6 12h0"/></svg><span>{showNavigation ? 'Hide navigation' : 'Show navigation'}</span></button>{index?.repository_url && <a className="btn btn-secondary notes-github-button" href={index.repository_url} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3 17.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5A3.9 3.9 0 0 1 7 7.8 3.6 3.6 0 0 1 7.1 5s.8-.3 2.9 1.1a10 10 0 0 1 5.2 0C17.2 4.7 18 5 18 5a3.6 3.6 0 0 1 .1 2.8 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V20c0 .3.2.6.7.5A9 9 0 0 0 12 3Z"/></svg><span>GitHub</span></a>}</div>
      <Breadcrumbs index={index} selectedPath={selectedPath} onDirectory={navigateBreadcrumb} />
    </header>
    <DismissibleError message={error} />
    <div className="notes-layout">
      <aside ref={navigationRef} id="notes-topic-navigation" className="notes-browser" aria-label="Repository topics" aria-hidden={!showNavigation}>
        <div className="notes-year-tabs" role="tablist" aria-label="Notes year">{years.map(year => <button type="button" role="tab" aria-selected={year === selectedYear} className={year === selectedYear ? 'active' : ''} key={year} onClick={() => selectYear(year)}><span>{displayName(year)}</span><small className="notes-count-badge">{allNotes.filter(item => taxonomy(item, index.root_path).year === year).length}</small></button>)}</div>
        <div className="notes-tree-toolbar"><label className="notes-search"><span>Search this repository</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Topic or note…" /></label><button type="button" className="notes-expand-button" onClick={() => setExpanded(Object.fromEntries(allTreePaths.map(path => [path, !allExpanded])))}>{allExpanded ? 'Collapse all' : 'Expand all'}</button></div>
        <div className="notes-tree-browser">
          <nav className="notes-topic-list" aria-label={`${selectedYear} topics`}>{topics.map(topic => { const count = filteredNotes.filter(item => { const value = taxonomy(item, index.root_path); return value.year === selectedYear && value.topic === topic }).length; return <button type="button" className={topic === selectedTopic ? 'active' : ''} key={topic} onClick={() => selectTopic(topic)}><span>{displayName(topic)}</span><small className="notes-count-badge">{count}</small></button> })}</nav>
          <nav className="notes-list" aria-label={`${selectedTopic} notes`}>{!loadingIndex && <NoteTree node={tree} selectedPath={selectedPath} expanded={expanded} onToggle={path => setExpanded(current => ({ ...current, [path]: current[path] === false }))} onSelect={selectNote} />}{!loadingIndex && !topicNotes.length && <p className="notes-empty">No notes match this search in {displayName(selectedTopic)}.</p>}</nav>
        </div>
      </aside>
      <main className="note-reader">{loadingNote ? <div className="note-reader-status"><span className="spinner" /> Loading note…</div> : note ? <><div className="note-reader-toolbar"><span>{note.title}</span><a href={note.github_url} target="_blank" rel="noreferrer">Edit / view on GitHub ↗</a></div><article className="markdown-body"><MarkdownContent note={note} headings={headings} /></article></> : <div className="note-reader-status">Choose a note to start reading.</div>}</main>
      <OnThisPage note={note} headings={headings} activeHeading={activeHeading} />
    </div>
  </div>
}
