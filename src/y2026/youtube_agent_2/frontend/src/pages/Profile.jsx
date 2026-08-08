import React from 'react'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { firebaseAuth, firebaseAuthReady, firebaseEnabled } from '../firebase'
import { connectYouTube as authorizeYouTube, getYouTubeConnectionStatus } from '../youtubeAuth'

export default function Profile({ showTitle = true }) {
  const [user, setUser] = React.useState(firebaseAuth?.currentUser || null)
  const [error, setError] = React.useState('')
  const [youtube, setYoutube] = React.useState(getYouTubeConnectionStatus())

  React.useEffect(() => {
    if (!firebaseAuth) return undefined
    return firebaseAuth.onIdTokenChanged(setUser)
  }, [])

  if (!firebaseEnabled) {
    return <div className="card profile-card">{showTitle && <h1>Profile</h1>}<p>Firebase is not configured for this environment yet.</p></div>
  }

  const signIn = async () => {
    setError('')
    try {
      await firebaseAuthReady
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    } catch (requestError) {
      setError(requestError.message || 'Google sign-in failed.')
    }
  }

  const connectYouTube = async () => {
    setError('')
    try {
      setYoutube(await authorizeYouTube())
    } catch (requestError) {
      setError(requestError.message || 'Unable to authorize YouTube.')
    }
  }

  return (
    <section className="profile-card card">
      {showTitle && <h1>Profile</h1>}
      {error && <div className="alert alert-error">{error}</div>}
      {user ? <>
        <div className="profile-identity">
          {user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{user.displayName?.charAt(0).toUpperCase() || '?'}</span>}
          <div><strong>{user.displayName || 'Google user'}</strong><small>{user.email}</small></div>
        </div>
        <p>Your learning plans and source-sync metadata are private to this signed-in account.</p>
        <section className="profile-youtube">
          <div><strong>YouTube connection</strong><small>{youtube.connected ? 'Connected for this browser tab' : 'Not connected'}</small></div>
          <button className="btn btn-secondary" onClick={connectYouTube}>{youtube.connected ? 'Reconnect YouTube' : 'Connect YouTube'}</button>
        </section>
        <p>The YouTube access token stays in memory and is cleared when this tab closes.</p>
        <button className="btn btn-secondary" onClick={() => signOut(firebaseAuth)}>Sign out</button>
      </> : <>
        <p>Sign in with Google to access your private learning plans.</p>
        <button className="btn btn-primary" onClick={signIn}>Continue with Google</button>
      </>}
    </section>
  )
}
