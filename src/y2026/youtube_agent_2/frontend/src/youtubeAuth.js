const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

let token = null
let expiresAt = 0
let scriptPromise = null

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Unable to load Google authorization'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function peekYouTubeAccessToken() {
  if (!token || Date.now() >= expiresAt) {
    token = null
    expiresAt = 0
  }
  return token
}

export function getYouTubeConnectionStatus() {
  return { connected: Boolean(peekYouTubeAccessToken()) }
}

export async function connectYouTube() {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured')
  await loadGoogleIdentityServices()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'YouTube authorization failed'))
          return
        }
        token = response.access_token
        expiresAt = Date.now() + Math.max(0, Number(response.expires_in || 3600) - 60) * 1000
        resolve(getYouTubeConnectionStatus())
      },
      error_callback: (error) => reject(new Error(error.message || 'YouTube authorization failed')),
    })
    client.requestAccessToken({ prompt: peekYouTubeAccessToken() ? '' : 'consent' })
  })
}
