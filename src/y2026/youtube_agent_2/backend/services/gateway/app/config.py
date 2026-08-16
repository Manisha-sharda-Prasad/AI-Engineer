"""Configuration owned by the API gateway."""

import os

from src.y2026.youtube_agent_2.backend.shared.platform import settings


YOUTUBE_SERVICE_URL = os.getenv(
    "GATEWAY_YOUTUBE_SERVICE_URL", "http://127.0.0.1:8002"
)
PLANS_SERVICE_URL = os.getenv(
    "GATEWAY_PLANS_SERVICE_URL", "http://127.0.0.1:8003"
)
REQUEST_TIMEOUT_SECS = settings.SERVICE_REQUEST_TIMEOUT_SECS
DOWNSTREAM_INVOKE_MODE = os.getenv("DOWNSTREAM_INVOKE_MODE", "http").lower()
YOUTUBE_FUNCTION_NAME = os.getenv("GATEWAY_YOUTUBE_FUNCTION_NAME", "")
PLANS_FUNCTION_NAME = os.getenv("GATEWAY_PLANS_FUNCTION_NAME", "")
DYNAMODB_TABLE_NAME = settings.DYNAMODB_TABLE_NAME
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_REQUESTS_PER_MINUTE = int(
    os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "60")
)
