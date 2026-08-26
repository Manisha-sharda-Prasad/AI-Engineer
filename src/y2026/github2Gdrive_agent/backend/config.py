import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
CACHE_DIR = STORAGE_DIR / "cache"
STATE_FILE = STORAGE_DIR / "agent_state.json"
CREDENTIALS_FILE = STORAGE_DIR / "gdrive_credentials.json"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_IGNORE_PATTERNS = [
    ".git",
    "node_modules",
    "__pycache__",
    "*.pyc",
    ".venv",
    "venv",
    ".env",
    ".DS_Store",
    "dist",
    "build",
    ".cache",
    ".idea",
    ".vscode"
]
