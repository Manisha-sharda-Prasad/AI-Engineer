import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock

cwd = str(Path.cwd())
if cwd not in sys.path:
    sys.path.insert(0, cwd)

from src.y2026.github2Gdrive_agent.backend.models import RepoConfig, GDriveConfig, SyncJobStatus

from src.y2026.github2Gdrive_agent.backend.git_manager import GitManager
from src.y2026.github2Gdrive_agent.backend.gdrive_manager import GDriveManager
from src.y2026.github2Gdrive_agent.backend.sync_engine import SyncEngine
from src.y2026.github2Gdrive_agent.backend.config import BASE_DIR

def test_ignore_pattern():
    assert GitManager.is_ignored(".git/config", [".git"]) is True
    assert GitManager.is_ignored("node_modules/express/index.js", ["node_modules"]) is True
    assert GitManager.is_ignored("src/index.js", ["node_modules"]) is False

async def test_local_repo_scan():
    repo = RepoConfig(
        id="test_local",
        name="github2Gdrive_agent",
        type="local",
        path_or_url=str(BASE_DIR),
        branch="main",
        ignore_patterns=[".git", "storage"]
    )
    files_info, logs = GitManager.scan_local_repo(repo)
    assert len(files_info) > 0
    assert any("requirements.txt" in f["relative_path"] for f in files_info)
    print("[OK] Local repo scan test passed")

async def test_remote_repo_scan():
    repo = RepoConfig(
        id="test_remote",
        name="octocat-Hello-World",
        type="remote",
        path_or_url="octocat/Hello-World",
        branch="master"
    )
    files_info, logs = await GitManager.scan_remote_repo(repo)
    assert len(files_info) > 0
    assert any("README" in f["relative_path"] for f in files_info)
    print("[OK] Remote GitHub repo scan test passed")

async def test_sync_engine_diff_and_execution():
    gdrive_config = GDriveConfig(root_folder_name="Test_Backups")

    # Mock Google Drive API Service for Unit Testing
    mock_service = MagicMock()
    mock_files = MagicMock()
    mock_service.files.return_value = mock_files
    mock_files.list.return_value.execute.return_value = {"files": [{"id": "mock_folder_id", "name": "github"}]}
    mock_files.create.return_value.execute.return_value = {"id": "mock_file_id"}

    GDriveManager._get_gdrive_service = lambda self: mock_service

    sync_engine = SyncEngine(gdrive_config)

    repo = RepoConfig(
        id="test_sync",
        name="github2Gdrive_agent",
        type="local",
        path_or_url=str(BASE_DIR),
        ignore_patterns=[".git", "storage", "__pycache__"]
    )

    diffs, logs = await sync_engine.calculate_repo_diff(repo)
    assert len(diffs) > 0

    job_status = SyncJobStatus(
        job_id="test_job",
        repo_id=repo.id,
        repo_name=repo.name,
        status="queued",
        dry_run=True,
        started_at=""
    )

    result_job = await sync_engine.execute_sync(repo, job_status)
    assert result_job.status == "completed"
    assert result_job.files_synced > 0
    print("[OK] Sync engine diff & dry-run test passed")

if __name__ == "__main__":
    test_ignore_pattern()
    asyncio.run(test_local_repo_scan())
    asyncio.run(test_remote_repo_scan())
    asyncio.run(test_sync_engine_diff_and_execution())
    print("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===")
