# AI Engineering

## Docs by year
- [2025](docs/2025-2030/README_2025.md)
- [2026](docs/2025-2030/README_2026.md)

---
## Generating mkdocs.yml
> Files ending with `__x.md` will be skipped
```bash
pip install -r requirements-netlify.txt
python scripts/generate_mkdocs.py
# .\scripts\generate_mkdocs.bat
mkdocs serve
```
---
## coding agent

| Tool                       |                         Price | Best For                                             |
| -------------------------- | ----------------------------: | ---------------------------------------------------- |
| **Claude Code**            |    Free (limited) / ~$20–$100 | Excellent for large codebases and terminal workflows |
| **Gemini CLI**             |                      **Free** | Great free terminal coding agent                     |
| **OpenAI Codex (ChatGPT)** |       Free limited / Plus $20 | Full-stack development, debugging, architecture      |
| **GitHub Copilot**         |                     $10/month | IDE autocomplete and chat                            |
| **Continue.dev**           |                      **Free** | VS Code extension using your own LLM                 |
| **Cline**                  | Free (pay only for API usage) | Powerful autonomous coding in VS Code                |
| **Aider**                  |      **Free** (API cost only) | Git-based coding agent from the terminal             |


---
## start youtube agent
```bash
uvicorn src.y2026.youtube_agent_2.backend.services.gateway.app.main:app --reload --port 8001
```
```bash
uvicorn src.y2026.youtube_agent_2.backend.services.youtube.app.main:app --reload --port 8002
```
```bash
uvicorn src.y2026.youtube_agent_2.backend.services.plans.app.main:app --reload --port 8003
```
```bash
cd src\y2026\youtube_agent_2\frontend; npm run dev
````