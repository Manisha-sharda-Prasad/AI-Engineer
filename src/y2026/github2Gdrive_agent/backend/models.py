from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class RepoConfig(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # "local" or "remote"
    path_or_url: str  # Local folder path or GitHub URL / repo slug
    branch: str = "main"
    enabled: bool = True
    target_folder_name: Optional[str] = None
    last_synced: Optional[str] = None
    ignore_patterns: List[str] = Field(default_factory=list)


class GDriveConfig(BaseModel):
    mode: str = "service_account"
    connected: bool = False
    root_folder_name: str = "github"
    root_folder_id: Optional[str] = None
    service_account_json: Optional[str] = None


class FileDiff(BaseModel):
    relative_path: str
    size_bytes: int
    local_modified_at: str
    status: str  # "new", "modified", "synced", "ignored", "deleted"
    gdrive_file_id: Optional[str] = None
    reason: Optional[str] = None

class SyncJobRequest(BaseModel):
    repo_id: str
    dry_run: bool = False
    force_all: bool = False
    selected_files: Optional[List[str]] = None

class SyncJobStatus(BaseModel):
    job_id: str
    repo_id: str
    repo_name: str
    status: str  # "queued", "running", "completed", "failed", "cancelled"
    dry_run: bool
    progress_percent: float = 0.0
    files_total: int = 0
    files_synced: int = 0
    files_failed: int = 0
    bytes_transferred: int = 0
    current_file: Optional[str] = None
    selected_files: Optional[List[str]] = None
    started_at: str
    finished_at: Optional[str] = None
    error_message: Optional[str] = None
    logs: List[str] = Field(default_factory=list)


class AgentState(BaseModel):
    gdrive: GDriveConfig = Field(default_factory=GDriveConfig)
    repos: List[RepoConfig] = Field(default_factory=list)
    auto_sync_interval_minutes: int = 0  # 0 means disabled
    sync_history: List[SyncJobStatus] = Field(default_factory=list)
