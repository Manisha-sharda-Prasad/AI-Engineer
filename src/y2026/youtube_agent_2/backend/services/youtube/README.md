# YouTube Service

Owns request-scoped YouTube channel/playlist/video catalog access. The browser
supplies a short-lived access token; this service never stores or logs it. It
does not import plans models or plan repositories.

```powershell
uvicorn src.y2026.youtube_agent_2.backend.services.youtube.app.main:app --reload --port 8002
```
