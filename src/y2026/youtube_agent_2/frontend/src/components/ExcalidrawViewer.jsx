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

/**
 * Split binary buffer encoded with Excalidraw's concatBuffers format:
 * [4 bytes version][4 bytes len1][chunk1][4 bytes len2][chunk2]...
 */
function splitConcatBuffers(u8) {
  if (!u8 || u8.byteLength < 8) return null
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const version = dv.getUint32(0)
  if (version !== 1) return null
  let cursor = 4
  const parts = []
  while (cursor < u8.byteLength) {
    if (cursor + 4 > u8.byteLength) break
    const chunkSize = dv.getUint32(cursor)
    cursor += 4
    if (cursor + chunkSize > u8.byteLength) break
    parts.push(u8.slice(cursor, cursor + chunkSize))
    cursor += chunkSize
  }
  return parts
}

/** Import a 128-bit base64url key into a Web Crypto CryptoKey using JWK format. */
async function getCryptoKey(key) {
  return await crypto.subtle.importKey(
    'jwk',
    {
      alg: 'A128GCM',
      ext: true,
      k: key,
      key_ops: ['encrypt', 'decrypt'],
      kty: 'oct',
    },
    {
      name: 'AES-GCM',
      length: 128,
    },
    false,
    ['decrypt']
  )
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
 * Binary format: [outer concatBuffers: metadata, 12-byte IV, ciphertext]
 * Payload format: [deflated/compressed bytes -> inner concatBuffers: metadata, JSON string]
 */
async function fetchScene(fileId, key) {
  const directUrl = `https://json.excalidraw.com/api/v2/${fileId}`
  const proxyUrl = `/excalidraw-api/v2/${fileId}`
  let response
  try {
    response = await fetch(proxyUrl)
    if (!response.ok) response = await fetch(directUrl)
  } catch {
    response = await fetch(directUrl)
  }
  if (!response.ok) throw new Error(`Scene fetch failed (HTTP ${response.status}).`)

  const buffer = await response.arrayBuffer()
  const raw = new Uint8Array(buffer)
  if (raw.length < 13) throw new Error('Scene data too short — may be corrupt or expired.')

  let iv, ciphertext
  const outerParts = splitConcatBuffers(raw)
  if (outerParts && outerParts.length >= 3) {
    iv = outerParts[1]
    ciphertext = outerParts[2]
  } else {
    // Legacy unpadded format
    iv = raw.slice(0, 12)
    ciphertext = raw.slice(12)
  }

  const cryptoKey = await getCryptoKey(key)
  let decrypted
  try {
    decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
  } catch (cryptoErr) {
    const detail = cryptoErr?.message || cryptoErr?.name || String(cryptoErr)
    throw new Error(`Decryption failed — the scene may be expired or the key is wrong. (${detail})`)
  }

  // Decompress via pako
  const { inflate, inflateRaw } = await import('pako')
  let inflated
  try {
    inflated = inflate(new Uint8Array(decrypted))
  } catch {
    try {
      inflated = inflateRaw(new Uint8Array(decrypted))
    } catch {
      inflated = new Uint8Array(decrypted)
    }
  }

  // Extract JSON data (check for inner concatBuffers)
  const innerParts = splitConcatBuffers(inflated)
  let jsonStr
  if (innerParts && innerParts.length >= 2) {
    jsonStr = new TextDecoder().decode(innerParts[1])
  } else {
    jsonStr = new TextDecoder().decode(inflated)
  }

  return JSON.parse(jsonStr)
}

/** Returns true if the URL points to a .excalidraw JSON file (not a shared excalidraw.com link). */
function isExcalidrawFileUrl(url) {
  try { return new URL(url).pathname.toLowerCase().endsWith('.excalidraw') } catch { return false }
}

export default function ExcalidrawViewer({ url, onFallback }) {
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

  // Automatically navigate to new tab if drawing fails to load/decrypt
  React.useEffect(() => {
    if (status === 'error' && url) {
      if (onFallback) {
        onFallback()
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
  }, [status, url, onFallback])

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
        <small>Opening original drawing in a new tab…</small>
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
