"""Request-scoped YouTube Data API client.

The browser supplies a short-lived OAuth access token on each request. Tokens
are never persisted, refreshed, or logged by the backend.
"""

from __future__ import annotations

import re
from typing import Optional

import requests
from fastapi import HTTPException

from src.y2026.youtube_agent_2.backend.services.youtube.app import config
from src.y2026.youtube_agent_2.backend.shared.platform import identity

_API = "https://www.googleapis.com/youtube/v3"


def _headers() -> dict[str, str]:
    token = identity.current_youtube_access_token()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Connect YouTube in this browser before accessing YouTube data",
        )
    return {"Authorization": f"Bearer {token}"}


def _get(url: str, *, headers: dict, params: dict) -> dict:
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
    except requests.RequestException as error:
        raise RuntimeError(f"YouTube request failed: {error}") from error
    if response.status_code != 200:
        raise RuntimeError(
            f"YouTube API returned {response.status_code}: {response.text}"
        )
    return response.json()


def _pages(url: str, *, headers: dict, params: dict):
    next_page = None
    while True:
        page_params = {**params}
        if next_page:
            page_params["pageToken"] = next_page
        data = _get(url, headers=headers, params=page_params)
        yield from data.get("items", [])
        next_page = data.get("nextPageToken")
        if not next_page:
            return


def _best_thumbnail(snippet: dict) -> str:
    thumbnails = snippet.get("thumbnails", {})
    for size in ("high", "medium", "default"):
        if url := thumbnails.get(size, {}).get("url"):
            return url
    return ""


def _parse_iso_duration(value: str) -> int:
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value or "")
    if not match:
        return 0
    hours, minutes, seconds = (int(group or 0) for group in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def _channel_details(channel_ids: list[str], headers: dict) -> dict:
    details = {}
    for offset in range(0, len(channel_ids), 50):
        data = _get(
            f"{_API}/channels",
            headers=headers,
            params={
                "part": "snippet,statistics",
                "id": ",".join(channel_ids[offset : offset + 50]),
                "maxResults": 50,
            },
        )
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            details[item.get("id")] = {
                "title": snippet.get("title", ""),
                "thumbnail": _best_thumbnail(snippet),
                "source_created_at": snippet.get("publishedAt", ""),
                "videos_count": int(item.get("statistics", {}).get("videoCount") or 0),
            }
    return details


def _enrich_videos(videos: list[dict], headers: dict) -> list[dict]:
    details = {}
    ids = [video["video_id"] for video in videos if video.get("video_id")]
    for offset in range(0, len(ids), 50):
        data = _get(
            f"{_API}/videos",
            headers=headers,
            params={
                "part": "snippet,contentDetails,status,statistics,recordingDetails",
                "id": ",".join(ids[offset : offset + 50]),
                "maxResults": 50,
            },
        )
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            details[item.get("id")] = {
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "duration_secs": _parse_iso_duration(item.get("contentDetails", {}).get("duration", "")),
                "published_at": snippet.get("publishedAt", ""),
                "thumbnail": _best_thumbnail(snippet),
                "tags": snippet.get("tags", []),
                "category_id": snippet.get("categoryId"),
                "caption_available": item.get("contentDetails", {}).get("caption") == "true",
                "embeddable": item.get("status", {}).get("embeddable", True),
                "view_count": int(item.get("statistics", {}).get("viewCount") or 0),
                "like_count": int(item.get("statistics", {}).get("likeCount") or 0),
                "recording_date": item.get("recordingDetails", {}).get("recordingDate") or None,
            }
    for video in videos:
        detail = details.get(video.get("video_id"), {})
        video.update({key: value for key, value in detail.items() if value not in (None, "")})
        video.setdefault("duration_secs", 0)
        video.setdefault("tags", [])
        video.setdefault("caption_available", False)
        video.setdefault("embeddable", True)
        video.setdefault("view_count", 0)
        video.setdefault("like_count", 0)
    return videos


def list_subscribed_channels() -> list[dict]:
    headers = _headers()
    channels = []
    for item in _pages(
        config.YOUTUBE_SUBSCRIPTIONS_API,
        headers=headers,
        params={"part": "snippet", "mine": "true", "maxResults": 50},
    ):
        snippet = item.get("snippet", {})
        channel_id = snippet.get("resourceId", {}).get("channelId")
        channels.append(
            {
                "channel_id": channel_id,
                "title": snippet.get("title"),
                "url": f"https://youtube.com/channel/{channel_id}",
                "thumbnail": _best_thumbnail(snippet),
                "source_created_at": snippet.get("publishedAt", ""),
            }
        )
    details = _channel_details(
        [channel["channel_id"] for channel in channels if channel.get("channel_id")],
        headers,
    )
    for channel in channels:
        channel.update({k: v for k, v in details.get(channel.get("channel_id"), {}).items() if v not in (None, "")})
    return channels


def get_channel_playlists(channel_id: str) -> list[dict]:
    headers = _headers()
    return [
        {
            "playlist_id": item.get("id"),
            "title": item.get("snippet", {}).get("title"),
            "description": item.get("snippet", {}).get("description"),
            "thumbnail": _best_thumbnail(item.get("snippet", {})),
            "source_created_at": item.get("snippet", {}).get("publishedAt", ""),
            "videos_count": int(item.get("contentDetails", {}).get("itemCount") or 0),
        }
        for item in _pages(
            f"{_API}/playlists",
            headers=headers,
            params={"part": "snippet,contentDetails", "channelId": channel_id, "maxResults": 50},
        )
    ]


def get_playlist_videos(playlist_id: str) -> list[dict]:
    headers = _headers()
    videos = []
    for item in _pages(
        f"{_API}/playlistItems",
        headers=headers,
        params={"part": "snippet,contentDetails", "playlistId": playlist_id, "maxResults": 50},
    ):
        snippet = item.get("snippet", {})
        content = item.get("contentDetails", {})
        video_id = content.get("videoId") or snippet.get("resourceId", {}).get("videoId")
        if video_id:
            videos.append(
                {
                    "video_id": video_id,
                    "title": snippet.get("title"),
                    "description": snippet.get("description", ""),
                    "thumbnail": _best_thumbnail(snippet),
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "position": snippet.get("position"),
                    "playlist_id": snippet.get("playlistId") or playlist_id,
                    "playlist_item_id": item.get("id"),
                    "added_to_playlist_at": snippet.get("publishedAt", ""),
                    "published_at": content.get("videoPublishedAt", ""),
                }
            )
    return _enrich_videos(videos, headers)


def get_channel_videos(
    channel_id: str, published_after: Optional[str] = None
) -> list[dict]:
    headers = _headers()
    if published_after:
        videos = []
        seen_ids = set()
        for activity in _pages(
            f"{_API}/activities",
            headers=headers,
            params={
                "part": "snippet,contentDetails",
                "channelId": channel_id,
                "publishedAfter": published_after,
                "maxResults": 50,
            },
        ):
            snippet = activity.get("snippet", {})
            video_id = activity.get("contentDetails", {}).get("upload", {}).get("videoId")
            if snippet.get("type") != "upload" or not video_id or video_id in seen_ids:
                continue
            seen_ids.add(video_id)
            videos.append(
                {
                    "video_id": video_id,
                    "title": snippet.get("title") or "Untitled video",
                    "description": snippet.get("description") or "",
                    "thumbnail": _best_thumbnail(snippet),
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "published_at": snippet.get("publishedAt", ""),
                }
            )
        return _enrich_videos(videos, headers)

    data = _get(
        f"{_API}/channels",
        headers=headers,
        params={"part": "contentDetails", "id": channel_id},
    )
    items = data.get("items", [])
    if not items:
        raise RuntimeError(f"YouTube channel not found: {channel_id}")
    playlist_id = items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    if not playlist_id:
        raise RuntimeError(f"YouTube uploads playlist not found for channel {channel_id}")
    return get_playlist_videos(playlist_id)
