import React from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

/** Parse #json=<fileId>,<key> from a shared Excalidraw URL. */
function parseExcalidrawHash(url) {
  try {
    const hash = new URL(url).hash.replace(/^#/, '')
    const match = hash.match(/^json=([^,]+),(.+)$/)
    return match ? { fileId: match[1], key: match[2] } : null
  } catch {
    return null
  }
}

/** Decode a base64url string to a Uint8Array. */
function base64UrlToBytes(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + (4 - (str.length % 4)) % 4, '='
  )
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

/**
 * Fetch a local/remote .excalidraw file — these are plain JSON, no encryption.
 * The URL is a resolved raw GitHub URL or a local dev-server URL.
 */
async function fetchFileScene(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`File fetch failed (HTTP ${response.status}).`)
  const text = await response.text()
  return JSON.parse(text)
}

/**
 * Fetch and decrypt an excalidraw.com shared scene.
 * Storage format: [12-byte IV][AES-GCM ciphertext]
 * Data is zlib-compressed JSON (fflate/zlibSync format) before encryption.
 */
async function fetchScene(fileId, key) {
  // Use a Vite dev-proxy path (/excalidraw-api) to avoid CORS issues in development.
  // In production the path resolves to a server-side proxy or direct request.
  const proxyUrl = `/excalidraw-api/v2/${fileId}`
  const directUrl = `https://json.excalidraw.com/api/v2/${fileId}`
  let response
  try {
    response = await fetch(proxyUrl)
  } catch {
    // Fall back to direct request if proxy path doesn't exist (e.g., production build)
    response = await fetch(directUrl)
  }
  if (!response.ok) throw new Error(`Scene fetch failed (HTTP ${response.status}).`)

  const buffer = await response.arrayBuffer()
  const raw = new Uint8Array(buffer)
  if (raw.length < 13) throw new Error('Scene data too short — may be corrupt or expired.')
  const iv = raw.slice(0, 12)
  const ciphertext = raw.slice(12)

  const keyBytes = base64UrlToBytes(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  )

  let decrypted
  try {
    decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
  } catch (cryptoErr) {
    const detail = cryptoErr?.message || cryptoErr?.name || String(cryptoErr)
    throw new Error(`Decryption failed — the scene may be expired or the key is wrong. (${detail})`)
  }

  // pako v2 no longer supports { to: 'string' }; always returns Uint8Array.
  const { inflate, inflateRaw } = await import('pako')
  let inflated
  try { inflated = inflate(new Uint8Array(decrypted)) } catch {
    try { inflated = inflateRaw(new Uint8Array(decrypted)) } catch {
      inflated = new Uint8Array(decrypted) // try as uncompressed (older scenes)
    }
  }
  return JSON.parse(new TextDecoder().decode(inflated))
}

/** Returns true if the URL points to a .excalidraw JSON file (not a shared excalidraw.com link). */
function isExcalidrawFileUrl(url) {
  try { return new URL(url).pathname.toLowerCase().endsWith('.excalidraw') } catch { return false }
}

export default function ExcalidrawViewer({ url }) {
  const [status, setStatus] = React.useState('loading')
  const [mode, setMode] = React.useState('') // 'file' | 'shared'
  const [error, setError] = React.useState('')
  const [sceneData, setSceneData] = React.useState(null)

  React.useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const load = async () => {
      try {
        let data
        if (isExcalidrawFileUrl(url)) {
          // ── Local or remote .excalidraw file → plain JSON, no decryption ──
          setMode('file')
          data = await fetchFileScene(url)
        } else {
          // ── excalidraw.com shared link → fetch + AES-GCM decrypt + decompress ──
          setMode('shared')
          const params = parseExcalidrawHash(url)
          if (!params) throw new Error('Invalid Excalidraw share URL — missing scene ID and decryption key.')
          data = await fetchScene(params.fileId, params.key)
        }
        if (!cancelled) { setSceneData(data); setStatus('ready') }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || err?.name || String(err) || 'Failed to load Excalidraw drawing.'
          console.error('[ExcalidrawViewer]', err)
          setError(msg)
          setStatus('error')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [url])

  const [excalidrawAPI, setExcalidrawAPI] = React.useState(null)

  React.useEffect(() => {
    if (!excalidrawAPI || !sceneData) return
    const timer = setTimeout(() => {
      excalidrawAPI.scrollToContent(undefined, { fitToViewport: true, animate: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [excalidrawAPI, sceneData])

  if (status === 'loading') {
    return (
      <div className="excalidraw-embed-status">
        <span className="spinner" />
        <strong>Loading Excalidraw drawing…</strong>
        <small>{mode === 'file' ? 'Reading scene file.' : 'Fetching and decrypting scene data.'}</small>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="excalidraw-embed-status is-error">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        <strong>Unable to load Excalidraw drawing</strong>
        <p>{error}</p>
        <small>You can still open the original drawing using the button below.</small>
      </div>
    )
  }

  return (
    <Excalidraw
      excalidrawAPI={api => setExcalidrawAPI(api)}
      viewModeEnabled
      initialData={{
        elements: sceneData?.elements,
        appState: {
          ...sceneData?.appState,
          collaborators: [],
          isLoading: false,
        },
        files: sceneData?.files,
        scrollToContent: true,
      }}
    />
  )
}
