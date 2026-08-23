# ⚡ GitHub to Google Drive Sync Agent (`github2Gdrive_agent`)

An automated, differential synchronization tool and web dashboard designed to back up local Git workspace directories and remote GitHub repositories to Google Drive.

---

## ✨ Features

- **Local Git Repository Backup**: Scans local disk repositories, respects `.gitignore` rules, calculates SHA-256 hashes, and syncs modified/new files.
- **Remote GitHub Repository Backup**: Interacts with public or private GitHub repositories via GitHub REST API / branch trees.
- **Google Drive Storage Integration**: Supports Google Cloud Service Account JSON credentials, OAuth, or out-of-the-box local demo mock driver (`storage/mock_gdrive`).
- **Differential Scanning & Diff Inspector**: Displays calculated file diffs (`NEW`, `MODIFIED`, `SYNCED`, `IGNORED`) before syncing.
- **Real-Time Live Console**: Streaming log output, transfer speeds, percentage progress bar, and sync history.
- **CLI Utility**: Command-line interface (`uv run python src/y2026/github2Gdrive_agent/cli.py sync --repo <name>`) for automated cron jobs or terminal usage.
- **Background Auto-Sync**: Schedule periodic backups every 5, 15, 30, or 60 minutes.

---

## 📁 File Structure

```
src/y2026/github2Gdrive_agent/
├── backend/
│   ├── main.py            # FastAPI REST API & static server
│   ├── git_manager.py     # Local & remote GitHub tree parser
│   ├── gdrive_manager.py  # Google Drive API & demo storage driver
│   ├── sync_engine.py    # Differential engine & sync execution
│   ├── scheduler.py       # Auto-sync background runner
│   ├── models.py          # Pydantic data schemas
│   └── config.py          # App storage configuration
├── frontend/              # Vite + React Modern Web Dashboard
│   ├── dist/              # Pre-built SPA distribution bundle
│   ├── src/
│   │   ├── components/    # Header, Stats, RepoList, DiffViewer, LiveConsole
│   │   ├── App.jsx
│   │   └── index.css      # Glassmorphism design system
│   ├── index.html
│   └── vite.config.js
├── tests/
│   └── test_sync.py       # Verification test suite
├── cli.py                 # Terminal Command Line Interface
├── requirements.txt       # Python dependencies
└── README.md              # Documentation
```

---

## 🚀 Quick Start & Execution Guide

> **Note**: Python/CLI commands are run directly from the repository root: `c:\Users\Manisha\Documents\github-2025\genai` using `uv`.

### 1. Install Python Dependencies

Install dependencies into the root virtual environment using `uv`:

```bash
uv add -r src/y2026/github2Gdrive_agent/requirements.txt
```

---

### 2. Run Command-Line Interface (CLI)

Run CLI commands directly from the repository root:

```bash
# List configured repositories
uv run python src/y2026/github2Gdrive_agent/cli.py list-repos

# Add a local repository (e.g. solution-engineer)
uv run python src/y2026/github2Gdrive_agent/cli.py add-repo --name solution-engineer --type local --path "C:\Users\Manisha\Documents\github-2025\solution-engineer"

# Add a remote GitHub repository
uv run python src/y2026/github2Gdrive_agent/cli.py add-repo --name hello-world --type remote --path "octocat/Hello-World"

# Inspect diffs against Google Drive backup state
uv run python src/y2026/github2Gdrive_agent/cli.py diff --repo solution-engineer

# Trigger dry-run scan (without uploading)
uv run python src/y2026/github2Gdrive_agent/cli.py sync --repo solution-engineer --dry-run

# Trigger real sync backup to Google Drive
uv run python src/y2026/github2Gdrive_agent/cli.py sync --repo solution-engineer
```

---

### 3. How to Run the Web Dashboard UI

You have **two options** to launch the Web UI:

#### Option A: Integrated Web Server (Recommended)

The React SPA is pre-built into `frontend/dist`. Simply start the backend server from the repository root:

```bash
uv run uvicorn src.y2026.github2Gdrive_agent.backend.main:app --reload --port 8000
```

Open your browser to: **[http://localhost:8000](http://localhost:8000)**

---

#### Option B: Standalone Vite Dev Server (For UI Development)

To run the frontend with hot module reloading:

```bash
cd src/y2026/github2Gdrive_agent/frontend ; npm run dev
```

Open your browser to: **[http://localhost:3000](http://localhost:3000)** (automatically proxies API calls to port `8000`).

---

### 4. Run Verification Test Suite

Run unit & integration tests from the repository root:

```bash
uv run python src/y2026/github2Gdrive_agent/tests/test_sync.py
```

---

## ⚙️ Google Drive Configuration

1. **Demo Mode (Default)**: Immediately test sync functionality out-of-the-box. Files are saved locally to `src/y2026/github2Gdrive_agent/storage/mock_gdrive/` with full metadata indexing.
2. **Google Service Account**:
   - Go to Google Cloud Console ➔ Enable **Google Drive API**.
   - Create a Service Account ➔ Download JSON Key File.
   - Click **Drive Settings** in the Web Dashboard or upload the JSON key file.
