"""Safe, read-only projections for published learning plans."""

from __future__ import annotations

from typing import Any


PLAN_FIELDS = {
    "name", "description", "logo_url", "icon_key", "labels",
    "created_at", "updated_at", "published_at",
}
COURSE_FIELDS = {
    "id", "title", "description", "logo_url", "icon_key", "labels",
    "sequence", "created_at", "updated_at",
}
MODULE_FIELDS = {"id", "title", "labels", "sequence"}
VIDEO_FIELDS = {
    "video_id", "title", "revised_title_from_ai", "description", "url",
    "sequence", "thumbnail", "duration_secs", "published_at", "tags",
    "category_id", "caption_available", "embeddable", "view_count",
    "like_count", "recording_date",
}
PRIVATE_WORKFLOW_LABELS = {"watched", "bookmarked", "mark_for_delete", "refresh_needed"}


def _pick(source: dict[str, Any], fields: set[str]) -> dict[str, Any]:
    projection = {key: source.get(key) for key in fields if key in source}
    if "labels" in projection:
        projection["labels"] = [
            label for label in (projection["labels"] or [])
            if label not in PRIVATE_WORKFLOW_LABELS
        ]
    return projection


def build_public_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """Return the only representation that anonymous callers may receive."""
    projection = {
        "share_id": plan.get("public_share_id"),
        **_pick(plan, PLAN_FIELDS),
        "courses": [],
    }
    for course in sorted(plan.get("courses") or [], key=lambda item: item.get("sequence", 0)):
        public_course = {**_pick(course, COURSE_FIELDS), "modules": []}
        for module in sorted(course.get("modules") or [], key=lambda item: item.get("sequence", 0)):
            public_module = {**_pick(module, MODULE_FIELDS), "videos": []}
            for video in sorted(module.get("videos") or [], key=lambda item: item.get("sequence", 0)):
                public_module["videos"].append(_pick(video, VIDEO_FIELDS))
            public_course["modules"].append(public_module)
        projection["courses"].append(public_course)
    return projection


def build_public_plan_summary(projection: dict[str, Any]) -> dict[str, Any]:
    """Return compact metadata for the anonymous public-plan gallery."""
    courses = projection.get("courses") or []
    modules = [module for course in courses for module in (course.get("modules") or [])]
    return {
        **_pick(projection, PLAN_FIELDS),
        "share_id": projection.get("share_id"),
        "plan_id": projection.get("plan_id"),
        "course_count": len(courses),
        "module_count": len(modules),
        "video_count": sum(len(module.get("videos") or []) for module in modules),
    }
