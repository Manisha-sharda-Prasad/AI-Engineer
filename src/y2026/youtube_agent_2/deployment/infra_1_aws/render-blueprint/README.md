# Render static UI

Render hosts only `youtube-learning-ui`; all APIs run in AWS Lambda.

Deploy [render-ui.yaml](render-ui.yaml) and configure:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Gateway Lambda Function URL, without a trailing slash |
| `VITE_FIREBASE_*` | Firebase web-app configuration |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth web client ID used by Google Identity Services |

Add the Render hostname to Firebase Authentication authorized domains and to
the Google OAuth client's authorized JavaScript origins. No Google client
secret or redirect URI is needed: YouTube uses the browser token flow and the
short-lived access token remains in JavaScript memory only.
