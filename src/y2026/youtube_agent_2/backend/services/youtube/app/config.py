"""Configuration owned by the YouTube integration service."""

from src.y2026.youtube_agent_2.backend.shared.platform import settings as platform


DEMO_CHANNELS: list[dict] = []
TRIM_VIDEO_DESC = True

DB_PATH = platform.BACKEND_ROOT / "youtubeldb.sqlite3"

STORAGE_BACKEND = platform.STORAGE_BACKEND
DATABASE_URL = platform.DATABASE_URL
FIREBASE_PROJECT_ID = platform.FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON = platform.FIREBASE_SERVICE_ACCOUNT_JSON
FRONTEND_URL = platform.FRONTEND_URL

YOUTUBE_SUBSCRIPTIONS_API = (
    "https://www.googleapis.com/youtube/v3/subscriptions"
)
