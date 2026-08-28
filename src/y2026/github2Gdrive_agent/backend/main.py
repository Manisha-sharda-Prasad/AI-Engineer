import os
import sys
import json
import uuid
from datetime import datetime
from pathlib import Path

cwd = str(Path.cwd())
if cwd not in sys.path:
    sys.path.insert(0, cwd)

from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse

from src.y2026.github2Gdrive_agent.backend.config import STATE_FILE, CREDENTIALS_FILE, BASE_DIR
from src.y2026.github2Gdrive_agent.backend.models import (
    AgentState, RepoConfig, GDriveConfig, SyncJobRequest, SyncJobStatus, FileDiff
)
from src.y2026.github2Gdrive_agent.backend.sync_engine import SyncEngine
from src.y2026.github2Gdrive_agent.backend.scheduler import AutoScheduler

app = FastAPI(title="GitHub to Google Drive Sync Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State Management
def load_state() -> AgentState:
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return AgentState(**data)
        except Exception as e:
            print(f"Error loading state file: {e}")

    initial_state = AgentState(
        gdrive=GDriveConfig(mode="demo", connected=True, root_folder_name="GitHub_Backups"),
        repos=[],
        auto_sync_interval_minutes=0
    )
    save_state(initial_state)
    return initial_state

def save_state(state: AgentState):
    state_dict = state.model_dump()
    for job in state_dict.get("sync_history", []):
        job["logs"] = []  # Omit file logs from persistent disk state
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state_dict, f, indent=2)


current_state = load_state()
active_jobs: Dict[str, SyncJobStatus] = {}

def update_job_in_state(job: SyncJobStatus):
    active_jobs[job.job_id] = job
    # Also update sync history in current state
    history = [j for j in current_state.sync_history if j.job_id != job.job_id]
    history.insert(0, job)
    current_state.sync_history = history[:20]  # keep last 20
    save_state(current_state)

async def auto_sync_all_repos():
    print("Auto-syncing all enabled repositories...")
    sync_engine = SyncEngine(current_state.gdrive)
    for repo in current_state.repos:
        if repo.enabled:
            job_id = f"auto_{uuid.uuid4().hex[:8]}"
            job_status = SyncJobStatus(
                job_id=job_id,
                repo_id=repo.id,
                repo_name=repo.name,
                status="queued",
                dry_run=False,
                started_at=datetime.now().isoformat()
            )
            update_job_in_state(job_status)
            await sync_engine.execute_sync(repo, job_status, update_callback=update_job_in_state)

scheduler = AutoScheduler(auto_sync_all_repos)
if current_state.auto_sync_interval_minutes > 0:
    scheduler.start(current_state.auto_sync_interval_minutes)

# --- API Endpoints ---

@app.get("/api/state", response_model=AgentState)
def get_agent_state():
    current_state.gdrive.connected = os.path.exists(CREDENTIALS_FILE)
    return current_state


@app.post("/api/state")
def update_agent_state(state: AgentState):
    global current_state
    current_state = state
    save_state(current_state)
    if state.auto_sync_interval_minutes > 0:
        scheduler.start(state.auto_sync_interval_minutes)
    else:
        scheduler.stop()
    return {"status": "success", "state": current_state}

@app.post("/api/repos")
def add_or_update_repo(repo: RepoConfig):
    if not repo.id:
        repo.id = f"repo_{uuid.uuid4().hex[:8]}"
    existing_idx = next((i for i, r in enumerate(current_state.repos) if r.id == repo.id), None)
    if existing_idx is not None:
        current_state.repos[existing_idx] = repo
    else:
        current_state.repos.append(repo)
    save_state(current_state)
    return {"status": "success", "repo": repo}

@app.delete("/api/repos/{repo_id}")
def delete_repo(repo_id: str):
    current_state.repos = [r for r in current_state.repos if r.id != repo_id]
    save_state(current_state)
    return {"status": "success", "repo_id": repo_id}

@app.get("/api/repos/{repo_id}/diff")
async def get_repo_diff(repo_id: str):
    repo = next((r for r in current_state.repos if r.id == repo_id), None)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    sync_engine = SyncEngine(current_state.gdrive)
    try:
        diffs, logs = await sync_engine.calculate_repo_diff(repo)
        return {"repo_id": repo_id, "repo_name": repo.name, "diffs": diffs, "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/sync")
async def trigger_sync(req: SyncJobRequest, background_tasks: BackgroundTasks):
    repo = next((r for r in current_state.repos if r.id == req.repo_id), None)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job_status = SyncJobStatus(
        job_id=job_id,
        repo_id=repo.id,
        repo_name=repo.name,
        status="queued",
        dry_run=req.dry_run,
        selected_files=req.selected_files,
        started_at=datetime.now().isoformat()
    )

    update_job_in_state(job_status)

    async def run_sync_task():
        sync_engine = SyncEngine(current_state.gdrive)
        await sync_engine.execute_sync(repo, job_status, update_callback=update_job_in_state)
        # Update repo last_synced
        repo.last_synced = datetime.now().isoformat()
        save_state(current_state)

    background_tasks.add_task(run_sync_task)
    return {"status": "queued", "job_id": job_id, "job": job_status}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    job = active_jobs.get(job_id)
    if not job:
        job = next((j for j in current_state.sync_history if j.job_id == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/api/gdrive/config")
def update_gdrive_config(config: GDriveConfig):
    current_state.gdrive = config
    save_state(current_state)
    return {"status": "success", "gdrive": config}

@app.post("/api/gdrive/upload-credentials")
async def upload_gdrive_credentials(request: Request, file: Optional[UploadFile] = File(None)):
    try:
        if file is not None:
            content = await file.read()
            text = content.decode("utf-8").strip()
        else:
            body_bytes = await request.body()
            text = body_bytes.decode("utf-8").strip()
        
        json_content = json.loads(text)
        with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
            json.dump(json_content, f, indent=2)
        
        current_state.gdrive.mode = "service_account"
        current_state.gdrive.service_account_json = None  # Kept securely in CREDENTIALS_FILE on disk
        current_state.gdrive.connected = True
        save_state(current_state)
        return {"status": "success", "message": "Credentials uploaded securely to local backend storage"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credentials JSON: {str(e)}")



# Serve Static Frontend Files if built
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
