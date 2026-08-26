import asyncio
import time
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Callable
from src.y2026.github2Gdrive_agent.backend.git_manager import GitManager
from src.y2026.github2Gdrive_agent.backend.gdrive_manager import GDriveManager
from src.y2026.github2Gdrive_agent.backend.models import RepoConfig, GDriveConfig, FileDiff, SyncJobStatus

class SyncEngine:
    def __init__(self, gdrive_config: GDriveConfig):
        self.gdrive = GDriveManager(gdrive_config)

    def _log(self, job_status: Optional[SyncJobStatus], message: str):
        print(message)
        if job_status is not None:
            job_status.logs.append(message)
            if len(job_status.logs) > 50:
                job_status.logs = job_status.logs[-50:]

    async def calculate_repo_diff(self, repo: RepoConfig) -> Tuple[List[FileDiff], List[str]]:
        """
        Scans repo and Google Drive target folder to build a list of FileDiff items.
        """
        logs = []
        msg = f"Starting diff analysis for repo '{repo.name}' ({repo.type})"
        print(msg)
        logs.append(msg)

        # 1. Fetch file list from git source
        if repo.type == "local":
            files_info, git_logs = GitManager.scan_local_repo(repo)
        else:
            files_info, git_logs = await GitManager.scan_remote_repo(repo)
        for gl in git_logs:
            print(gl)
        logs.extend(git_logs)

        # 2. Get destination Google Drive folder hierarchy: <root_folder> / <repo_name> / <branch_name>
        root_folder_name = self.gdrive.config.root_folder_name or "github"
        root_folder_id, root_folder_logs = await self.gdrive.get_or_create_folder(root_folder_name)
        for rl in root_folder_logs:
            print(rl)
        logs.extend(root_folder_logs)

        repo_folder_id, repo_folder_logs = await self.gdrive.get_or_create_folder(
            repo.name, parent_id=root_folder_id
        )
        for rpl in repo_folder_logs:
            print(rpl)
        logs.extend(repo_folder_logs)

        branch_name = repo.branch or "main"
        dest_folder_id, dest_folder_logs = await self.gdrive.get_or_create_folder(
            branch_name, parent_id=repo_folder_id
        )
        for dl in dest_folder_logs:
            print(dl)
        logs.extend(dest_folder_logs)


        # 3. Fetch existing files in Google Drive folder
        existing_gdrive_files = await self.gdrive.list_remote_files(dest_folder_id)

        # 4. Compute differences
        diffs: List[FileDiff] = []
        for file_info in files_info:
            rel_path = file_info["relative_path"]
            size = file_info["size_bytes"]
            ignored = file_info.get("ignored", False)
            content_hash = file_info.get("content_hash", "")

            if ignored:
                diffs.append(FileDiff(
                    relative_path=rel_path,
                    size_bytes=size,
                    local_modified_at=str(file_info.get("modified_at", 0)),
                    status="ignored",
                    reason="Matched ignore pattern (.gitignore / settings)"
                ))
                continue

            if rel_path in existing_gdrive_files:
                remote_meta = existing_gdrive_files[rel_path]
                remote_hash = remote_meta.get("content_hash") or remote_meta.get("hash", "")

                # Compare hash if present, or size
                if content_hash and remote_hash and content_hash == remote_hash:
                    diff_status = "synced"
                    reason = "Content hash matches Google Drive backup"
                elif remote_meta.get("size_bytes") == size or remote_meta.get("size") == size:
                    diff_status = "synced"
                    reason = "File size matches Google Drive backup"
                else:
                    diff_status = "modified"
                    reason = "Local content changed since last backup"

                diffs.append(FileDiff(
                    relative_path=rel_path,
                    size_bytes=size,
                    local_modified_at=str(file_info.get("modified_at", 0)),
                    status=diff_status,
                    gdrive_file_id=remote_meta.get("id"),
                    reason=reason
                ))
            else:
                diffs.append(FileDiff(
                    relative_path=rel_path,
                    size_bytes=size,
                    local_modified_at=str(file_info.get("modified_at", 0)),
                    status="new",
                    reason="New file not yet present on Google Drive"
                ))

        active_count = sum(1 for d in diffs if d.status in ["new", "modified"])
        synced_count = sum(1 for d in diffs if d.status == "synced")
        ignored_count = sum(1 for d in diffs if d.status == "ignored")

        summary_msg = f"Diff summary: {active_count} to sync ({sum(1 for d in diffs if d.status=='new')} new, {sum(1 for d in diffs if d.status=='modified')} modified), {synced_count} up-to-date, {ignored_count} ignored"
        print(summary_msg)
        logs.append(summary_msg)

        return diffs, logs

    async def execute_sync(
        self,
        repo: RepoConfig,
        job_status: SyncJobStatus,
        update_callback: Optional[Callable[[SyncJobStatus], None]] = None
    ) -> SyncJobStatus:
        """
        Executes real or dry-run synchronization job.
        """
        job_status.status = "running"
        self._log(job_status, f"[{datetime.now().strftime('%H:%M:%S')}] Launching sync job for repo '{repo.name}' (Dry-Run: {job_status.dry_run})")
        if update_callback: update_callback(job_status)

        try:
            # 1. Fetch file list
            if repo.type == "local":
                files_info, git_logs = GitManager.scan_local_repo(repo)
            else:
                files_info, git_logs = await GitManager.scan_remote_repo(repo)
            for gl in git_logs:
                self._log(job_status, gl)

            # Filter active files (and apply selected_files filter if specified)
            active_files = [f for f in files_info if not f.get("ignored", False)]
            if job_status.selected_files and len(job_status.selected_files) > 0:
                selected_set = set(job_status.selected_files)
                active_files = [f for f in active_files if f["relative_path"] in selected_set]
                self._log(job_status, f"Selective Sync active: filtered to {len(active_files)} selected files.")

            job_status.files_total = len(active_files)
            if update_callback: update_callback(job_status)


            # 2. Get destination Google Drive folder hierarchy: <root_folder> / <repo_name> / <branch_name>
            root_folder_name = self.gdrive.config.root_folder_name or "github"
            root_folder_id, root_logs = await self.gdrive.get_or_create_folder(root_folder_name)
            for rl in root_logs:
                self._log(job_status, rl)

            repo_folder_id, repo_logs = await self.gdrive.get_or_create_folder(
                repo.name, parent_id=root_folder_id
            )
            for rpl in repo_logs:
                self._log(job_status, rpl)

            branch_name = repo.branch or "main"
            dest_folder_id, dest_logs = await self.gdrive.get_or_create_folder(
                branch_name, parent_id=repo_folder_id
            )
            for dl in dest_logs:
                self._log(job_status, dl)


            # 3. Check existing backup files
            existing_gdrive_files = await self.gdrive.list_remote_files(dest_folder_id)

            # 4. Sync loop
            for idx, file_info in enumerate(active_files, 1):
                rel_path = file_info["relative_path"]
                content_hash = file_info.get("content_hash", "")
                job_status.current_file = rel_path

                # Check if up-to-date
                if rel_path in existing_gdrive_files:
                    remote_meta = existing_gdrive_files[rel_path]
                    remote_hash = remote_meta.get("content_hash") or remote_meta.get("hash", "")
                    if (content_hash and remote_hash and content_hash == remote_hash) or \
                       (remote_meta.get("size_bytes") == file_info["size_bytes"]):
                        self._log(job_status, f"[{idx}/{len(active_files)}] Skip unchanged: '{rel_path}'")
                        job_status.files_synced += 1
                        job_status.progress_percent = round((idx / len(active_files)) * 100, 1)
                        if update_callback: update_callback(job_status)
                        continue

                if job_status.dry_run:
                    self._log(job_status, f"[{idx}/{len(active_files)}] [DRY-RUN] Would upload '{rel_path}' ({file_info['size_bytes']} bytes)")
                    job_status.files_synced += 1
                    job_status.bytes_transferred += file_info["size_bytes"]
                else:
                    self._log(job_status, f"[{idx}/{len(active_files)}] Uploading '{rel_path}' ({file_info['size_bytes']} bytes)...")
                    try:
                        content_bytes = await GitManager.get_file_content_bytes(file_info)
                        file_id, upload_logs = await self.gdrive.upload_file(
                            repo_name=repo.name,
                            folder_id=dest_folder_id,
                            relative_path=rel_path,
                            content=content_bytes,
                            content_hash=content_hash
                        )
                        for ul in upload_logs:
                            self._log(job_status, ul)
                        job_status.files_synced += 1
                        job_status.bytes_transferred += len(content_bytes)
                    except Exception as upload_err:
                        job_status.files_failed += 1
                        self._log(job_status, f"ERROR uploading '{rel_path}': {str(upload_err)}")

                job_status.progress_percent = round((idx / len(active_files)) * 100, 1)
                if update_callback: update_callback(job_status)
                await asyncio.sleep(0.001)

            job_status.status = "completed"
            job_status.finished_at = datetime.now().isoformat()
            self._log(job_status, f"[{datetime.now().strftime('%H:%M:%S')}] Sync job completed! Synced: {job_status.files_synced}/{job_status.files_total}, Failed: {job_status.files_failed}, Transferred: {job_status.bytes_transferred} bytes")
            if update_callback: update_callback(job_status)

        except Exception as e:
            job_status.status = "failed"
            job_status.error_message = str(e)
            job_status.finished_at = datetime.now().isoformat()
            self._log(job_status, f"[{datetime.now().strftime('%H:%M:%S')}] Sync job FAILED: {str(e)}")
            if update_callback: update_callback(job_status)

        return job_status

