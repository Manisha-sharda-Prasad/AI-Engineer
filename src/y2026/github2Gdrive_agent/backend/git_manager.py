import os
import hashlib
import fnmatch
import httpx
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from src.y2026.github2Gdrive_agent.backend.config import CACHE_DIR, DEFAULT_IGNORE_PATTERNS
from src.y2026.github2Gdrive_agent.backend.models import FileDiff, RepoConfig

class GitManager:
    @staticmethod
    def is_ignored(rel_path: str, ignore_patterns: List[str]) -> bool:
        combined_patterns = DEFAULT_IGNORE_PATTERNS + (ignore_patterns or [])
        parts = Path(rel_path).parts
        for pattern in combined_patterns:
            # Check pattern against relative path or any path component
            if fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(rel_path, f"*{pattern}*"):
                return True
            for part in parts:
                if fnmatch.fnmatch(part, pattern):
                    return True
        return False

    @staticmethod
    def calculate_file_hash(filepath: Path) -> str:
        """Calculate SHA-256 hash of a local file."""
        hasher = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            return ""

    @classmethod
    def scan_local_repo(cls, repo: RepoConfig) -> Tuple[List[Dict], List[str]]:
        """
        Scans a local git repository folder and returns a list of file info dicts.
        """
        repo_path = Path(repo.path_or_url).resolve()
        if not repo_path.exists() or not repo_path.is_dir():
            raise ValueError(f"Local path does not exist or is not a directory: {repo.path_or_url}")

        files_info = []
        logs = [f"Scanning local repository at: {repo_path}"]

        for root, dirs, files in os.walk(repo_path):
            rel_dir = os.path.relpath(root, repo_path)
            if rel_dir == ".":
                rel_dir = ""

            # Filter out ignored directories early
            dirs_to_remove = []
            for d in dirs:
                rel_d = os.path.join(rel_dir, d) if rel_dir else d
                if cls.is_ignored(rel_d, repo.ignore_patterns):
                    dirs_to_remove.append(d)
            for d in dirs_to_remove:
                dirs.remove(d)

            for f in files:
                rel_file = os.path.join(rel_dir, f).replace("\\", "/")
                full_path = Path(root) / f

                ignored = cls.is_ignored(rel_file, repo.ignore_patterns)
                stat = full_path.stat()

                files_info.append({
                    "relative_path": rel_file,
                    "full_path": str(full_path),
                    "size_bytes": stat.st_size,
                    "modified_at": stat.st_mtime,
                    "ignored": ignored,
                    "content_hash": cls.calculate_file_hash(full_path) if not ignored else ""
                })

        logs.append(f"Found {len(files_info)} files ({sum(1 for f in files_info if not f['ignored'])} active, {sum(1 for f in files_info if f['ignored'])} ignored)")
        return files_info, logs

    @classmethod
    async def scan_remote_repo(cls, repo: RepoConfig) -> Tuple[List[Dict], List[str]]:
        """
        Scans a remote GitHub repository using GitHub REST API or local cache clone.
        """
        clean_url = repo.path_or_url.strip().rstrip("/")
        if "github.com" in clean_url:
            parts = clean_url.split("github.com/")[-1].split("/")
            owner, repo_name = parts[0], parts[1].replace(".git", "")
        elif "/" in clean_url:
            owner, repo_name = clean_url.split("/")[:2]
        else:
            raise ValueError(f"Invalid GitHub repository URL/slug: {repo.path_or_url}")

        branch = repo.branch or "main"
        logs = [f"Fetching remote tree for GitHub repo: {owner}/{repo_name} (branch: {branch})"]

        target_cache_dir = CACHE_DIR / f"{owner}_{repo_name}_{branch}"
        target_cache_dir.mkdir(parents=True, exist_ok=True)

        api_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{branch}?recursive=1"
        files_info = []

        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            res = await client.get(api_url, headers={"User-Agent": "github2Gdrive-agent"})
            if res.status_code == 404 and branch == "main":
                # Try master branch if main 404s
                branch = "master"
                api_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{branch}?recursive=1"
                res = await client.get(api_url, headers={"User-Agent": "github2Gdrive-agent"})

            if res.status_code != 200:
                logs.append(f"GitHub API HTTP {res.status_code}: {res.text}")
                raise ValueError(f"Failed to fetch GitHub repo metadata (HTTP {res.status_code}). Ensure repo is public or valid.")

            data = res.json()
            tree = data.get("tree", [])
            logs.append(f"Retrieved {len(tree)} raw tree nodes from GitHub API")

            for item in tree:
                if item.get("type") != "blob":
                    continue
                
                rel_path = item.get("path").replace("\\", "/")
                size = item.get("size", 0)
                sha = item.get("sha", "")
                download_url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/{branch}/{rel_path}"

                ignored = cls.is_ignored(rel_path, repo.ignore_patterns)

                files_info.append({
                    "relative_path": rel_path,
                    "download_url": download_url,
                    "size_bytes": size,
                    "modified_at": 0,
                    "ignored": ignored,
                    "content_hash": sha,
                    "cache_dir": str(target_cache_dir)
                })

        logs.append(f"Parsed {len(files_info)} remote files ({sum(1 for f in files_info if not f['ignored'])} active)")
        return files_info, logs

    @classmethod
    async def get_file_content_bytes(cls, file_info: Dict) -> bytes:
        """Returns byte content for local or remote file."""
        if "full_path" in file_info and file_info["full_path"]:
            with open(file_info["full_path"], "rb") as f:
                return f.read()
        elif "download_url" in file_info and file_info["download_url"]:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(file_info["download_url"])
                if res.status_code == 200:
                    return res.content
                else:
                    raise Exception(f"Failed to download remote file HTTP {res.status_code}: {file_info['download_url']}")
        else:
            raise ValueError("Invalid file info: missing full_path or download_url")
