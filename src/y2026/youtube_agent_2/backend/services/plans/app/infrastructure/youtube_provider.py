"""HTTP adapter from plans workflows to the YouTube service."""

from __future__ import annotations

import json
import base64
from typing import Protocol
from urllib.parse import urlencode

import requests
from fastapi import HTTPException

from src.y2026.youtube_agent_2.backend.shared.contracts.youtube import (
    ChannelRecord,
    PlaylistRecord,
    VideoRecord,
)
from src.y2026.youtube_agent_2.backend.shared.platform import identity
from src.y2026.youtube_agent_2.backend.services.plans.app import config


class SourceProvider(Protocol):
    def list_channels(self) -> list[ChannelRecord]: ...

    def get_channel_playlists(self, channel_id: str) -> list[PlaylistRecord]: ...

    def get_playlist_videos(self, playlist_id: str) -> list[VideoRecord]: ...

    def get_channel_videos(
        self, channel_id: str, published_after: str | None = None
    ) -> list[VideoRecord]: ...


class HttpYouTubeProvider:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        if not config.INTERNAL_SERVICE_TOKEN:
            raise HTTPException(
                status_code=503,
                detail="INTERNAL_SERVICE_TOKEN is required for YouTube service calls",
            )
        user_id = identity.current_user_id()
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Firebase user identity is required for YouTube service calls",
            )
        headers = {
            "X-Internal-Service-Token": config.INTERNAL_SERVICE_TOKEN,
            "X-Internal-User-ID": user_id,
        }
        access_token = identity.current_youtube_access_token()
        if access_token:
            headers["X-YouTube-Access-Token"] = access_token
        return headers

    def _get(self, path: str, params: dict | None = None) -> dict:
        try:
            response = requests.get(
                f"{self.base_url}{path}",
                params=params,
                headers=self._headers(),
                timeout=config.SERVICE_REQUEST_TIMEOUT_SECS,
            )
        except requests.RequestException as error:
            raise HTTPException(status_code=503, detail=f"YouTube service unavailable: {error}") from error

        if not response.ok:
            try:
                detail = response.json().get("detail", response.text)
            except ValueError:
                detail = response.text
            raise HTTPException(status_code=response.status_code, detail=detail)
        return response.json()

    def list_channels(self) -> list[dict]:
        return self._get("/api/channels").get("channels", [])

    def get_channel_playlists(self, channel_id: str) -> list[dict]:
        return self._get(f"/api/{channel_id}/playlists").get("playlists", [])

    def get_playlist_videos(self, playlist_id: str) -> list[dict]:
        return self._get("/api/videos", {"channel_id": "internal", "playlist_id": playlist_id}).get("videos", [])

    def get_channel_videos(
        self, channel_id: str, published_after: str | None = None
    ) -> list[dict]:
        params = {"channel_id": channel_id}
        if published_after:
            params["published_after"] = published_after
        return self._get("/api/videos", params).get("videos", [])


class LambdaYouTubeProvider(HttpYouTubeProvider):
    def __init__(self, function_name: str):
        super().__init__("")
        self.function_name = function_name
        import boto3

        self.client = boto3.client("lambda")

    def _get(self, path: str, params: dict | None = None) -> dict:
        user_id = identity.current_user_id()
        if not user_id:
            raise HTTPException(status_code=401, detail="Firebase identity required")
        headers = {}
        access_token = identity.current_youtube_access_token()
        if access_token:
            headers["X-YouTube-Access-Token"] = access_token
        event = {
            "source": "youtube-agent.gateway",
            "user_id": user_id,
            "request": {
                "method": "GET",
                "path": path,
                "query": urlencode(params or {}),
                "headers": headers,
            },
        }
        result = self.client.invoke(
            FunctionName=self.function_name,
            InvocationType="RequestResponse",
            Payload=json.dumps(event).encode(),
        )
        payload = json.loads(result["Payload"].read())
        if result.get("FunctionError"):
            raise HTTPException(status_code=503, detail="YouTube service unavailable")
        raw_body = payload.get("body") or "{}"
        if payload.get("isBase64Encoded"):
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        body = json.loads(raw_body)
        status = int(payload.get("statusCode", 500))
        if status >= 400:
            raise HTTPException(status_code=status, detail=body.get("detail", body))
        return body


_provider_override: SourceProvider | None = None


def configure_source_provider(provider: SourceProvider | None) -> None:
    """Override the HTTP adapter from a controlled composition root or test."""
    global _provider_override
    _provider_override = provider


def get_source_provider() -> SourceProvider:
    if _provider_override:
        return _provider_override
    if config.DOWNSTREAM_INVOKE_MODE == "lambda":
        return LambdaYouTubeProvider(config.YOUTUBE_FUNCTION_NAME)
    return HttpYouTubeProvider(config.YOUTUBE_SERVICE_URL)
