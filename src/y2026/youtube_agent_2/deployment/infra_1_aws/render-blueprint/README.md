# Deployment plan -1 :: Render
> ONLY UI RUNS RENDER, rest moved to AWS.
### 1. URL/Links
- UI : https://youtube-learning-ui.onrender.com/profile
- DB : https://console.neon.tech/app/projects/red-snow-76080021/branches/br-red-bread-auwkl017/sql-editor?database=neondb
- backend :
    - https://youtube-learning-gateway.onrender.com/docs
    - https://youtube-learning-youtube.onrender.com/docs
    - https://youtube-learning-plans.onrender.com/docs

### 2. Blueprint yaml
[render-microservices.yaml](render-microservices.yaml)
- `youtube-learning-gateway`: the public API URL used by the frontend.
- `youtube-learning-youtube`: YouTube OAuth and catalog integration.
- `youtube-learning-plans`: plans, courses, and source synchronization.

[render-ui.yaml](render-ui.yaml)
- `youtube-learning-ui`: the React/Vite static site.

### 3. Environment variable
| Render service | Variable | Value |
| --- | --- | --- |
| Gateway | `GATEWAY_YOUTUBE_SERVICE_URL` | URL of `youtube-learning-youtube` |
| Gateway | `GATEWAY_PLANS_SERVICE_URL` | URL of `youtube-learning-plans` |
| Plans | `YOUTUBE_SERVICE_URL` | URL of `youtube-learning-youtube` |
| UI | `VITE_API_BASE_URL` | URL of `youtube-learning-gateway` |

| Variable | Service | Notes |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | YouTube, plans | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | YouTube, plans | Complete Admin service-account JSON |
| `FRONTEND_URL` | Gateway, YouTube, plans | Exact deployed UI origin |
| `GOOGLE_CLIENT_ID` | YouTube | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | YouTube | Matching client secret |
| `GOOGLE_REDIRECT_URI` | YouTube | `https://<gateway-url>/auth/google/callback` |
| `YOUTUBE_TOKEN_ENCRYPTION_KEY` | YouTube | Stable Fernet key |

The blueprint enables Firebase and requires authentication for the YouTube and
plans services. It also generates `YOUTUBE_OAUTH_STATE_SECRET` automatically.

Configure the UI's `VITE_FIREBASE_*` variables using the Firebase Web App
configuration. Vite embeds these values at build time, so redeploy the UI after
changing them.

### 4. Configure Google and Firebase consoles
1. Add `https://<gateway-url>/auth/google/callback` to the Google OAuth web
   client's authorized redirect URIs.
2. Add the deployed UI hostname to Firebase Authentication's authorized
   domains.
3. Confirm Google sign-in is enabled in Firebase Authentication.

### 5. Verify the deployment
1. Confirm `/health` returns success for the gateway, YouTube, and plans URLs.
2. Open the UI and sign in with Google.
3. Connect YouTube and confirm the callback returns to `/profile`.
4. Create and update a plan through the gateway.
5. Test with two Firebase accounts and confirm their Firestore data and
   YouTube connections remain isolated.

