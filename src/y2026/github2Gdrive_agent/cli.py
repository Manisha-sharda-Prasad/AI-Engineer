#!/usr/bin/env python3
import sys
import argparse

import asyncio
import json
from pathlib import Path

cwd = str(Path.cwd())
if cwd not in sys.path:
    sys.path.insert(0, cwd)

from src.y2026.github2Gdrive_agent.backend.main import load_state, save_state

from src.y2026.github2Gdrive_agent.backend.models import RepoConfig, SyncJobStatus
from src.y2026.github2Gdrive_agent.backend.sync_engine import SyncEngine

def print_banner():
    print("=" * 60)
    print(" GitHub to Google Drive Sync Agent (github2Gdrive_agent) CLI")
    print("=" * 60)

async def cmd_list_repos(args):
    state = load_state()
    print(f"\nConfigured Repositories ({len(state.repos)} total):")
    print("-" * 60)
    for r in state.repos:
        status_str = "ENABLED" if r.enabled else "DISABLED"
        print(f"[{r.id}] {r.name}")
        print(f"   Type: {r.type.upper()} | Path/URL: {r.path_or_url}")
        print(f"   Branch: {r.branch} | Target Folder: {r.target_folder_name or 'Default'}")
        print(f"   Last Synced: {r.last_synced or 'Never'} | Status: {status_str}")
        print("-" * 60)

async def cmd_add_repo(args):
    state = load_state()
    repo_id = f"repo_{args.name.replace(' ', '_').lower()}"
    new_repo = RepoConfig(
        id=repo_id,
        name=args.name,
        type=args.type,
        path_or_url=args.path,
        branch=args.branch or "main",
        enabled=True,
        target_folder_name=args.target_folder or args.name
    )

    state.repos.append(new_repo)
    save_state(state)
    print(f"Successfully added repository '{args.name}' (ID: {repo_id})")

async def cmd_diff(args):
    state = load_state()
    repo = next((r for r in state.repos if r.id == args.repo or r.name.lower() == args.repo.lower()), None)
    if not repo:
        print(f"Error: Repository '{args.repo}' not found.")
        sys.exit(1)

    print(f"Calculating diff for repository '{repo.name}'...")
    sync_engine = SyncEngine(state.gdrive)
    diffs, logs = await sync_engine.calculate_repo_diff(repo)
    
    print("\n--- Execution Logs ---")
    for log in logs:
        print(f"  {log}")

    print(f"\n--- File Diffs ({len(diffs)} total) ---")
    print(f"{'STATUS':<10} | {'SIZE':<10} | {'PATH'}")
    print("-" * 60)
    for d in diffs:
        print(f"{d.status.upper():<10} | {d.size_bytes:<10} | {d.relative_path}")

async def cmd_sync(args):
    state = load_state()
    repo = next((r for r in state.repos if r.id == args.repo or r.name.lower() == args.repo.lower()), None)
    if not repo:
        print(f"Error: Repository '{args.repo}' not found.")
        sys.exit(1)

    print(f"Starting sync for repository '{repo.name}' (Dry Run: {args.dry_run})...")
    sync_engine = SyncEngine(state.gdrive)
    
    job_status = SyncJobStatus(
        job_id="cli_job",
        repo_id=repo.id,
        repo_name=repo.name,
        status="queued",
        dry_run=args.dry_run,
        started_at=""
    )

    def log_printer(status: SyncJobStatus):
        if status.logs:
            print(status.logs[-1])

    await sync_engine.execute_sync(repo, job_status, update_callback=log_printer)
    print(f"\nSync finished with status: {job_status.status.upper()}")

def main():
    print_banner()
    parser = argparse.ArgumentParser(description="GitHub to Google Drive Sync Agent CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # list-repos
    subparsers.add_parser("list-repos", help="List all configured repositories")

    # add-repo
    add_parser = subparsers.add_parser("add-repo", help="Add a new repository")
    add_parser.add_argument("--name", required=True, help="Name of the repository")
    add_parser.add_argument("--type", choices=["local", "remote"], required=True, help="Repository type")
    add_parser.add_argument("--path", required=True, help="Local directory path or remote GitHub URL/slug")
    add_parser.add_argument("--branch", default="main", help="Git branch (default: main)")
    add_parser.add_argument("--target-folder", help="Target Google Drive folder name")

    # diff
    diff_parser = subparsers.add_parser("diff", help="Check diff status between repository and Google Drive")
    diff_parser.add_argument("--repo", required=True, help="Repository ID or name")

    # sync
    sync_parser = subparsers.add_parser("sync", help="Trigger sync job for a repository")
    sync_parser.add_argument("--repo", required=True, help="Repository ID or name")
    sync_parser.add_argument("--dry-run", action="store_true", help="Perform dry-run scan without uploading")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "list-repos":
        asyncio.run(cmd_list_repos(args))
    elif args.command == "add-repo":
        asyncio.run(cmd_add_repo(args))
    elif args.command == "diff":
        asyncio.run(cmd_diff(args))
    elif args.command == "sync":
        asyncio.run(cmd_sync(args))

if __name__ == "__main__":
    main()
