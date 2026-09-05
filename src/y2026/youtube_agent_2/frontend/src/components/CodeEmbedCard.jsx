import React from 'react'
import Prism from 'prismjs'
import { LANGUAGE_ALIASES, LANGUAGE_LABELS, escapeHtml } from './CodeBlock'

const codeFileCache = new Map()

function parseIpynbCode(jsonStr) {
  try {
    const notebook = JSON.parse(jsonStr)
    if (!Array.isArray(notebook.cells)) return jsonStr

    const codePieces = []
    notebook.cells.forEach((cell, idx) => {
      const src = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')
      if (!src.trim()) return
      if (cell.cell_type === 'code') {
        codePieces.push(`# --- Cell ${idx + 1} [code] ---\n${src}`)
      } else if (cell.cell_type === 'markdown') {
        const commentMd = src.split('\n').map(l => `# ${l}`).join('\n')
        codePieces.push(`# --- Cell ${idx + 1} [markdown] ---\n${commentMd}`)
      }
    })
    return codePieces.join('\n\n')
  } catch {
    return jsonStr
  }
}

export async function fetchCodeFile(url, bypassCache = false) {
  if (!bypassCache && codeFileCache.has(url)) {
    const cached = codeFileCache.get(url)
    if (Date.now() - cached.timestamp < 3000) {
      return cached.text
    }
  }

  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to fetch file from ${url}`)
  let text = await res.text()
  if (url.toLowerCase().endsWith('.ipynb')) {
    text = parseIpynbCode(text)
  }
  codeFileCache.set(url, { text, timestamp: Date.now() })
  return text
}

export function detectLanguage(filePath = '') {
  const clean = filePath.split('?')[0].split('#')[0]
  const ext = clean.split('.').at(-1)?.toLowerCase()
  const map = {
    py: 'python',
    ipynb: 'python',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    jsx: 'jsx',
    tsx: 'tsx',
    json: 'json',
    jsonc: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    html: 'markup',
    xml: 'markup',
    svg: 'markup',
    css: 'css',
    scss: 'css',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    go: 'go',
    java: 'java',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    md: 'markdown',
    markdown: 'markdown',
    dockerfile: 'docker',
    toml: 'toml',
    ini: 'ini',
  }
  return map[ext] || 'text'
}

export function relativeUrl(value, rawUrl) {
  if (!value || !rawUrl || /^(?:[a-z]+:|#|\/\/)/i.test(value)) return value
  try { return new URL(value, rawUrl).toString() } catch { return value }
}

export function resolveSnippetTarget(target, allLines) {
  const totalLines = allLines.length
  if (!target) {
    return {
      found: true,
      startLine: null,
      endLine: null,
      sliceStart: 0,
      sliceEnd: totalLines,
      label: 'Full File',
      linesCount: totalLines,
      error: null,
    }
  }

  // Explicit line range
  if (target.startLine != null || target.endLine != null) {
    const sLine = target.startLine
    const eLine = target.endLine
    const sliceStart = sLine ? Math.max(0, sLine - 1) : 0
    const sliceEnd = eLine ? Math.min(totalLines, eLine) : totalLines
    const label = target.label || (sLine && eLine ? `Lines ${sLine}–${eLine}` : (sLine ? `Line ${sLine}+` : 'Snippet'))
    return {
      found: true,
      startLine: sLine,
      endLine: eLine,
      sliceStart,
      sliceEnd,
      label,
      linesCount: Math.max(0, sliceEnd - sliceStart),
      error: null,
    }
  }

  // Section name
  const sectionName = (typeof target === 'string' ? target : target.section || target.label || '').trim()
  if (!sectionName) {
    return {
      found: true,
      startLine: null,
      endLine: null,
      sliceStart: 0,
      sliceEnd: totalLines,
      label: 'Full File',
      linesCount: totalLines,
      error: null,
    }
  }

  const cleanSec = sectionName.trim()
  const escapedSec = cleanSec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const startRegex = new RegExp(`section\\s*:{1,2}\\s*${escapedSec}\\s*:{1,2}\\s*(?:start|begin)\\b`, 'i')
  const endRegex = new RegExp(`section\\s*:{1,2}\\s*${escapedSec}\\s*:{1,2}\\s*(?:end|stop|finish)\\b`, 'i')

  let startIdx = -1
  let endIdx = -1

  for (let idx = 0; idx < allLines.length; idx++) {
    const line = allLines[idx]
    if (startIdx === -1 && startRegex.test(line)) {
      startIdx = idx
    } else if (startIdx !== -1 && endRegex.test(line)) {
      endIdx = idx
      break
    }
  }

  if (startIdx === -1) {
    return {
      found: false,
      section: cleanSec,
      label: target.label || cleanSec,
      startLine: null,
      endLine: null,
      sliceStart: 0,
      sliceEnd: 0,
      linesCount: 0,
      error: `Section "${cleanSec}" not found in file`,
    }
  }

  const resolvedStart = startIdx + 2
  const resolvedEnd = endIdx !== -1 ? endIdx : totalLines
  const sliceStart = Math.max(0, resolvedStart - 1)
  const sliceEnd = Math.min(totalLines, Math.max(sliceStart, resolvedEnd))

  return {
    found: true,
    section: cleanSec,
    label: target.label || cleanSec,
    startLine: resolvedStart,
    endLine: Math.max(resolvedStart, resolvedEnd),
    sliceStart,
    sliceEnd,
    linesCount: Math.max(0, sliceEnd - sliceStart),
    error: null,
  }
}

export default function CodeEmbedCard({ files, src, startLine, endLine, section, tabs, note, onOpenCodeModal }) {
  const fileList = React.useMemo(() => {
    if (Array.isArray(files) && files.length > 0) {
      return files.map(f => ({
        ...f,
        filename: f.filename || (f.src || '').split('/').at(-1)?.split('?')[0]?.split('#')[0] || 'source-file'
      }))
    }
    if (src) {
      return [{
        src,
        filename: (src || '').split('/').at(-1)?.split('?')[0]?.split('#')[0] || 'source-file',
        startLine,
        endLine,
        section,
        tabs
      }]
    }
    return []
  }, [files, src, startLine, endLine, section, tabs])

  const [activeFileIdx, setActiveFileIdx] = React.useState(0)
  const [activeTabIdx, setActiveTabIdx] = React.useState(0)
  const [status, setStatus] = React.useState('loading')
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  const hasParentTabs = fileList.length > 1
  const safeFileIdx = Math.min(activeFileIdx, Math.max(0, fileList.length - 1))
  const currentFile = fileList[safeFileIdx] || fileList[0] || {}

  const currentSrc = currentFile.src || ''
  const resolvedUrl = relativeUrl(currentSrc, note?.raw_url)
  const filename = currentFile.filename || (currentSrc.split('/').at(-1) || 'source-file').split('?')[0].split('#')[0]
  const lang = detectLanguage(filename)
  const normalizedLang = LANGUAGE_ALIASES[lang?.toLowerCase()] || lang?.toLowerCase() || ''

  React.useEffect(() => {
    if (!resolvedUrl) return
    let cancelled = false
    setStatus('loading')
    setError('')

    fetchCodeFile(resolvedUrl, reloadToken > 0)
      .then(fullText => {
        if (!cancelled) {
          setCode(fullText)
          setStatus('ready')
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load source code')
          setStatus('error')
        }
      })

    return () => { cancelled = true }
  }, [resolvedUrl, reloadToken])

  const allLines = React.useMemo(() => (code || '').split(/\r?\n/), [code])
  const totalLines = allLines.length

  const tabList = React.useMemo(() => {
    if (Array.isArray(currentFile.tabs) && currentFile.tabs.length > 0) {
      return currentFile.tabs
    }
    if (currentFile.section) {
      return [{ section: currentFile.section, label: currentFile.section }]
    }
    if (currentFile.startLine || currentFile.endLine) {
      return [{
        startLine: currentFile.startLine,
        endLine: currentFile.endLine,
        label: currentFile.startLine && currentFile.endLine ? `Lines ${currentFile.startLine}–${currentFile.endLine}` : 'Snippet'
      }]
    }
    return [{ label: 'Full File' }]
  }, [currentFile])

  const resolvedTabs = React.useMemo(() => {
    return tabList.map(tab => resolveSnippetTarget(tab, allLines))
  }, [tabList, allLines])

  const hasSubTabs = resolvedTabs.length > 1
  const safeActiveTabIdx = Math.min(activeTabIdx, Math.max(0, resolvedTabs.length - 1))
  const activeResolution = resolvedTabs[safeActiveTabIdx] || resolvedTabs[0] || resolveSnippetTarget(null, allLines)

  const effectiveStartLine = activeResolution.startLine
  const effectiveEndLine = activeResolution.endLine
  const effectiveSection = activeResolution.section
  const sliceStart = activeResolution.sliceStart
  const sliceEnd = activeResolution.sliceEnd

  const displayedLines = React.useMemo(() => allLines.slice(sliceStart, sliceEnd), [allLines, sliceStart, sliceEnd])
  const displayedCode = React.useMemo(() => displayedLines.join('\n'), [displayedLines])

  const highlightedHtml = React.useMemo(() => {
    const raw = String(displayedCode ?? '').replace(/\n$/, '')
    const grammar = Prism.languages[normalizedLang]
    if (grammar) {
      try {
        return Prism.highlight(raw, grammar, normalizedLang)
      } catch {
        return escapeHtml(raw)
      }
    }
    return escapeHtml(raw)
  }, [displayedCode, normalizedLang])

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(displayedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleReload = (e) => {
    e.stopPropagation()
    setReloadToken(prev => prev + 1)
  }

  const handleOpenFull = () => {
    if (onOpenCodeModal) {
      onOpenCodeModal({
        title: filename,
        path: currentSrc,
        url: resolvedUrl,
        code,
        language: lang,
        totalLines,
        startLine: effectiveStartLine,
        endLine: effectiveEndLine,
        section: effectiveSection,
        tabs: hasSubTabs ? resolvedTabs : undefined,
        activeTabIdx: safeActiveTabIdx,
        files: hasParentTabs ? fileList : undefined,
        activeFileIdx: safeFileIdx,
        noteRawUrl: note?.raw_url,
      })
    }
  }

  const renderParentTabs = () => {
    if (!hasParentTabs) return null
    return (
      <div className="notes-code-embed-parent-tabs-bar" role="tablist" aria-label="Source Files">
        <div className="notes-code-embed-parent-tabs-group">
          {fileList.map((file, fIdx) => {
            const isActive = fIdx === safeFileIdx
            const fName = file.filename || (file.src || '').split('/').at(-1)?.split('?')[0] || `File ${fIdx + 1}`
            const fExt = fName.includes('.') ? fName.split('.').pop().toUpperCase() : 'CODE'
            return (
              <button
                key={fIdx}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`notes-code-embed-parent-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveFileIdx(fIdx)
                  setActiveTabIdx(0)
                }}
                title={file.src}
              >
                <span className="notes-code-file-icon">📄</span>
                <span className="notes-code-file-name">{fName}</span>
                <span className="notes-code-file-lang">{fExt}</span>
              </button>
            )
          })}
        </div>
        <div className="notes-code-embed-actions">
          <button
            type="button"
            className="notes-code-action-icon-btn"
            onClick={handleReload}
            title="Reload source file"
            aria-label="Reload source file"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
          </button>
          <button
            type="button"
            className="notes-code-action-icon-btn"
            onClick={handleOpenFull}
            title="Expand full code in dialog"
            aria-label="Expand full code in dialog"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
          <button
            type="button"
            className={`notes-code-action-icon-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied code' : 'Copy code snippet'}
            title={copied ? 'Copied!' : 'Copy code snippet'}
          >
            {copied ? (
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`notes-code-embed-card ${hasParentTabs ? 'has-parent-tabs' : ''}`}>
        {renderParentTabs()}
        <div className="notes-code-embed-loading">
          <span className="spinner" />
          <span>Loading <code>{currentSrc}</code>…</span>
        </div>
      </div>
    )
  }

  if (status === 'error' || (!hasSubTabs && !activeResolution.found && status === 'ready')) {
    const errMsg = !activeResolution.found
      ? activeResolution.error
      : (error || 'Failed to load source code')

    return (
      <div className={`notes-code-embed-card ${hasParentTabs ? 'has-parent-tabs' : ''}`}>
        {renderParentTabs()}
        <div className="notes-code-embed-error">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <div className="notes-code-embed-error-info">
            <strong>Unable to embed code from <code>{currentSrc}</code></strong>
            <small>{errMsg}</small>
            <div style={{ marginTop: '6px', display: 'flex', gap: '14px', alignItems: 'center' }}>
              {status === 'ready' && (
                <button
                  type="button"
                  onClick={handleOpenFull}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--notes-accent, #6366f1)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                >
                  Open full file ({totalLines} lines)
                </button>
              )}
              {resolvedUrl && (
                <a href={resolvedUrl} target="_blank" rel="noreferrer noopener" style={{ fontSize: '0.8rem' }}>Open raw ↗</a>
              )}
              <button
                type="button"
                onClick={handleReload}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--notes-accent, #6366f1)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
              >
                Reload file ↻
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasMoreAbove = sliceStart > 0
  const hasMoreBelow = sliceEnd < totalLines
  const isPartial = hasMoreAbove || hasMoreBelow
  const hiddenAboveCount = sliceStart
  const hiddenBelowCount = totalLines - sliceEnd

  const rangeDirection = hasMoreAbove && hasMoreBelow
    ? '↕'
    : hasMoreAbove
      ? '↑'
      : hasMoreBelow
        ? '↓'
        : ''

  const lineRangeLabel = isPartial
    ? (effectiveSection
        ? `§ ${effectiveSection} (Lines ${sliceStart + 1}–${sliceEnd} of ${totalLines})`
        : `${rangeDirection} Lines ${sliceStart + 1}–${sliceEnd} of ${totalLines}`.trim())
    : `${totalLines} lines`

  return (
    <div className={`notes-code-embed-card ${isPartial ? 'is-partial-snippet' : ''} ${hasSubTabs ? 'has-tabs' : ''} ${hasParentTabs ? 'has-parent-tabs' : ''}`}>
      {renderParentTabs()}

      {!hasParentTabs && (
        <div className="notes-code-embed-header">
          <div className="notes-code-embed-info">
            <span className="notes-code-block-dot" aria-hidden="true" />
            <strong className="notes-code-embed-filename" title={currentSrc}>{filename}</strong>
            {!hasSubTabs && (
              <span className="notes-code-embed-range-tag" title={isPartial ? `Snippet showing lines ${sliceStart + 1} to ${sliceEnd} of ${totalLines} total lines` : `${totalLines} total lines`}>
                {lineRangeLabel}
              </span>
            )}
          </div>
          <div className="notes-code-embed-actions">
            <button
              type="button"
              className="notes-code-action-icon-btn"
              onClick={handleReload}
              title="Reload source file"
              aria-label="Reload source file"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
              </svg>
            </button>
            <button
              type="button"
              className="notes-code-action-icon-btn"
              onClick={handleOpenFull}
              title="Expand full code in dialog"
              aria-label="Expand full code in dialog"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
            <button
              type="button"
              className={`notes-code-action-icon-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label={copied ? 'Copied code' : 'Copy code snippet'}
              title={copied ? 'Copied!' : 'Copy code snippet'}
            >
              {copied ? (
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {hasSubTabs && (
        <div className="notes-code-embed-tabs-bar is-sub-tabs" role="tablist" aria-label="Code Sections">
          {resolvedTabs.map((tab, idx) => {
            const isActive = idx === safeActiveTabIdx
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`notes-code-embed-tab-btn ${isActive ? 'is-active' : ''} ${!tab.found ? 'has-error' : ''}`}
                onClick={() => setActiveTabIdx(idx)}
                title={tab.found ? (tab.startLine ? `Lines ${tab.startLine}–${tab.endLine} (${tab.linesCount} lines)` : `${tab.label}`) : tab.error}
              >
                <span className="notes-code-tab-pill-icon">{tab.section ? '§' : '☷'}</span>
                <span className="notes-code-tab-label">{tab.label || tab.section}</span>
                {tab.found && tab.linesCount > 0 && (
                  <span className="notes-code-tab-lines-pill">{tab.linesCount}L</span>
                )}
                {!tab.found && (
                  <span className="notes-code-tab-err-dot" title={tab.error}>!</span>
                )}
              </button>
            )
          })}
          <div className="notes-code-embed-tabs-spacer" />
          <span className="notes-code-embed-tab-meta">
            {activeResolution.found && activeResolution.linesCount > 0
              ? `Lines ${activeResolution.sliceStart + 1}–${activeResolution.sliceEnd} of ${totalLines}`
              : ''}
          </span>
        </div>
      )}

      {!activeResolution.found ? (
        <div className="notes-code-embed-tab-error">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>{activeResolution.error || `Section "${activeResolution.label}" not found`}</span>
          <button
            type="button"
            onClick={handleReload}
            className="notes-code-dialog-inline-btn"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, color: 'var(--notes-accent, #6366f1)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            Reload file ↻
          </button>
        </div>
      ) : (
        <>
          {hasMoreAbove && (
            <button
              type="button"
              className="notes-code-truncation-bar is-top"
              onClick={handleOpenFull}
              title={`Click to view all ${totalLines} lines in dialog (${hiddenAboveCount} lines hidden above)`}
              aria-label={`View full file in dialog: ${hiddenAboveCount} lines above`}
            >
              <span className="notes-code-truncation-icon" aria-hidden="true">▲</span>
              <span className="notes-code-truncation-dots" aria-hidden="true">····</span>
              <span className="notes-code-truncation-text">
                <strong>{hiddenAboveCount} {hiddenAboveCount === 1 ? 'line' : 'lines'} above</strong>
                <small className="notes-code-truncation-range">(Lines 1–{hiddenAboveCount})</small>
              </span>
              <span className="notes-code-truncation-dots" aria-hidden="true">····</span>
            </button>
          )}

          <div className="notes-code-embed-body">
            <div className="notes-code-gutter" aria-hidden="true">
              {displayedLines.map((_, idx) => (
                <span key={idx}>{sliceStart + idx + 1}</span>
              ))}
            </div>
            <pre className={`language-${normalizedLang || 'none'}`}>
              <code
                className={`language-${normalizedLang || 'none'}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </pre>
          </div>

          {hasMoreBelow && (
            <button
              type="button"
              className="notes-code-truncation-bar is-bottom"
              onClick={handleOpenFull}
              title={`Click to view all ${totalLines} lines in dialog (${hiddenBelowCount} lines hidden below)`}
              aria-label={`View full file in dialog: ${hiddenBelowCount} more lines below`}
            >
              <span className="notes-code-truncation-icon" aria-hidden="true">▼</span>
              <span className="notes-code-truncation-dots" aria-hidden="true">····</span>
              <span className="notes-code-truncation-text">
                <strong>{hiddenBelowCount} more {hiddenBelowCount === 1 ? 'line' : 'lines'} below</strong>
                <small className="notes-code-truncation-range">(Lines {sliceEnd + 1}–{totalLines})</small>
              </span>
              <span className="notes-code-truncation-dots" aria-hidden="true">····</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
