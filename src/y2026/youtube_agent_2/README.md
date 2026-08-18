# Youtube Agent
## Docs
- [check here](../../../docs/2025-2030/03_youtube_agent)

## CD pipeline and IAC
- [check here](deployment)

## Run ⭐
env var
- [.env.example backend](backend/.env.example)
- [.env.example frontend](frontend/.env.example)
- http://127.0.0.1:8001/docs Gateway
- http://127.0.0.1:8001/docs plan service
- http://127.0.0.1:8001/docs YouTube service
- http://127.0.0.1:5173  UI

```
- python -m venv .venv
- .\.venv\Scripts\Activate.ps1
- uv add  -r src/y2026/youtube_agent_2/backend/services/plans/requirements.txt 
- uv add  -r src/y2026/youtube_agent_2/backend/services/youtube/requirements.txt 
- uv add  -r src/y2026/youtube_agent_2/backend/services/gateway/requirements.txt 
```

```bash

# API
uvicorn src.y2026.youtube_agent_2.backend.services.gateway.app.main:app --reload --port 8001
uvicorn src.y2026.youtube_agent_2.backend.services.youtube.app.main:app --reload --port 8002
uvicorn src.y2026.youtube_agent_2.backend.services.plans.app.main:app --reload --port 8003

# Start Vite
cd src\y2026\youtube_agent_2\frontend; npm run dev

# ==============================

# Docker Compose (optional)
# docker compose -f src/y2026/youtube_agent_2/deployment/docker/docker-compose.yml up --build

# Docker Desktop Kubernetes
# See deployment/kubernetes/README.md for build, secrets, and deploy commands.
# kubectl apply -k src/y2026/youtube_agent_2/deployment/kubernetes

# Helm (recommended for repeatable Kubernetes installs)
# helm upgrade --install youtube-agent src/y2026/youtube_agent_2/deployment/helm --namespace youtube-agent --create-namespace --wait
```

> fallback to SQLite, set env var  `STORAGE_BACKEND=sqlite`

> openai/gpt-oss-20b | models/gemini-3.6-flash


