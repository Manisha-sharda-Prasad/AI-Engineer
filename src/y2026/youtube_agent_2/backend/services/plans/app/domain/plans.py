"""Business operations for learning plans and courses."""

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException

from src.y2026.youtube_agent_2.backend.services.plans.app.config import ALLOWED_PREBUILT_LABELS
from src.y2026.youtube_agent_2.backend.services.plans.app.models import BulkProgressUpdateRequest, Course, CourseDeleteRequest, LearningPlan, MetadataUpdateRequest, PlaybackUpdateRequest, VideoBulkMoveRequest, VideoReorderRequest
from src.y2026.youtube_agent_2.backend.services.plans.app.repositories import store as db


def _load_plan(plan_id: str) -> LearningPlan:
    row = db.load_plan(plan_id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    return LearningPlan.model_validate(row)


def _reloaded_plan(plan_id: str) -> LearningPlan:
    """Read the canonical hierarchy after a targeted Firestore mutation."""
    return _load_plan(plan_id)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_plan(plan: LearningPlan) -> LearningPlan:
    db.save_plan(plan.model_dump())
    return plan


def list_plans() -> list[dict]:
    return db.list_plans()


def get_plan(plan_id: str) -> LearningPlan:
    return _load_plan(plan_id)


def delete_plan(plan_id: str) -> None:
    plan = _load_plan(plan_id)
    if not db.delete_plan(plan_id):
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.public_share_id:
        db.delete_public_plan(plan.public_share_id)


def publish_plan(plan_id: str) -> LearningPlan:
    plan = _load_plan(plan_id)
    if not plan.public_share_id:
        plan.public_share_id = secrets.token_urlsafe(16)
    plan.visibility = "public"
    plan.published_at = plan.published_at or _now()
    plan.updated_at = _now()
    db.save_plan(plan.model_dump())
    return plan


def unpublish_plan(plan_id: str) -> LearningPlan:
    plan = _load_plan(plan_id)
    share_id = plan.public_share_id
    plan.visibility = "private"
    plan.public_share_id = None
    plan.published_at = None
    plan.updated_at = _now()
    db.save_plan(plan.model_dump())
    if share_id:
        db.delete_public_plan(share_id)
    return plan


def get_public_plan(share_id: str) -> dict:
    projection = db.load_public_plan(share_id)
    if not projection:
        raise HTTPException(status_code=404, detail="Published plan not found")
    return projection


def list_public_plans(*, limit: int = 20, offset: int = 0) -> dict:
    from .public_projection import build_public_plan_summary

    plans, total = db.list_public_plans(limit=limit, offset=offset)
    return {
        "plans": [build_public_plan_summary(plan) for plan in plans],
        "limit": limit,
        "offset": offset,
        "total": total,
        "has_more": offset + len(plans) < total,
    }


def delete_courses(plan_id: str, request: CourseDeleteRequest) -> LearningPlan:
    plan = _load_plan(plan_id)
    course_ids = set(request.course_ids)
    missing_ids = course_ids - {course.id for course in plan.courses}
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Course not found: {', '.join(sorted(missing_ids))}")
    plan.courses = [course for course in plan.courses if course.id not in course_ids]
    plan.updated_at = _now()
    db.save_plan(plan.model_dump())
    return plan


def add_manual_course(plan_id: str, course: Course) -> LearningPlan:
    plan = _load_plan(plan_id)
    plan.courses.append(course)
    plan.updated_at = _now()
    db.save_plan(plan.model_dump())
    return plan


def update_plan_metadata(plan_id: str, request: MetadataUpdateRequest) -> LearningPlan:
    now = _now()
    fields = {key: value for key, value in {
        "name": request.name,
        "description": request.description,
        "logo_url": request.logo_url,
        "icon_key": request.icon_key,
    }.items() if value is not None}
    if db.supports_targeted_updates():
        fields["updated_at"] = now.isoformat()
        if not db.update_plan_fields(plan_id, fields):
            raise HTTPException(status_code=404, detail="Plan not found")
        return _reloaded_plan(plan_id)

    plan = _load_plan(plan_id)
    for field, value in fields.items():
        setattr(plan, field, value)
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def replace_plan(plan_id: str, replacement: LearningPlan) -> LearningPlan:
    existing = _load_plan(plan_id)
    if replacement.id != plan_id:
        raise HTTPException(
            status_code=422,
            detail="The uploaded plan id must match the current plan",
        )
    replacement.created_at = existing.created_at
    replacement.visibility = existing.visibility
    replacement.public_share_id = existing.public_share_id
    replacement.published_at = existing.published_at
    replacement.updated_at = _now()
    db.save_plan(replacement.model_dump())
    return replacement


def update_course_metadata(plan_id: str, course_id: str, request: MetadataUpdateRequest) -> LearningPlan:
    now = _now()
    direct_fields = {key: value for key, value in {
        "title": request.title,
        "description": request.description,
        "logo_url": request.logo_url,
        "icon_key": request.icon_key,
        "last_played_position_secs": request.last_played_position_secs,
        "last_played_at": request.last_played_at,
    }.items() if value is not None}

    # A last-played video must belong to this course. Retain the full validation
    # path for this less common metadata update until the playback route is the
    # sole caller for it.
    if db.supports_targeted_updates() and all(value is None for value in (
        request.last_played_video_id,
        request.last_played_position_secs,
        request.last_played_at,
    )):
        direct_fields["updated_at"] = now.isoformat()
        if not db.update_course_fields(plan_id, course_id, direct_fields):
            raise HTTPException(status_code=404, detail="Plan or course not found")
        return _reloaded_plan(plan_id)

    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for field, value in direct_fields.items():
        setattr(course, field, value)
    if request.last_played_video_id is not None:
        video_exists = any(video.video_id == request.last_played_video_id for module in course.modules for video in module.videos)
        if not video_exists:
            raise HTTPException(status_code=422, detail="Video does not belong to this course")
        course.last_played_video_id = request.last_played_video_id
    if request.last_played_position_secs is not None and not course.last_played_video_id:
        raise HTTPException(status_code=422, detail="A last played video is required before saving its position")
    course.updated_at = now
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def update_plan_labels(plan_id: str, labels: list[str]) -> LearningPlan:
    now = _now()
    if db.supports_targeted_updates():
        if not db.update_plan_fields(plan_id, {"labels": labels, "updated_at": now.isoformat()}):
            raise HTTPException(status_code=404, detail="Plan not found")
        return _reloaded_plan(plan_id)
    plan = _load_plan(plan_id)
    plan.labels = labels
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def update_course_labels(plan_id: str, course_id: str, labels: list[str]) -> LearningPlan:
    now = _now()
    if db.supports_targeted_updates():
        if not db.update_course_fields(plan_id, course_id, {"labels": labels, "updated_at": now.isoformat()}):
            raise HTTPException(status_code=404, detail="Plan or course not found")
        return _reloaded_plan(plan_id)
    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.labels = labels
    course.updated_at = now
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def _validate_prebuilt_labels(labels: list[str], level: str):
    invalid_labels = set(labels) - ALLOWED_PREBUILT_LABELS
    if invalid_labels:
        raise HTTPException(status_code=422, detail=f"Unsupported {level} labels: {', '.join(sorted(invalid_labels))}")


def update_module_labels(plan_id: str, course_id: str, module_id: str, labels: list[str]) -> LearningPlan:
    _validate_prebuilt_labels(labels, "module")
    now = _now()
    if db.supports_targeted_updates():
        if not db.update_module_fields(plan_id, course_id, module_id, {"labels": labels, "_updated_at": now.isoformat()}):
            raise HTTPException(status_code=404, detail="Plan, course, or module not found")
        return _reloaded_plan(plan_id)
    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    module = next((item for item in course.modules if item.id == module_id), None) if course else None
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.labels = labels
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def update_video_labels(plan_id: str, course_id: str, module_id: str, video_id: str, labels: list[str]) -> LearningPlan:
    # _validate_prebuilt_labels(labels, "video")
    now = _now()
    fields = {"labels": labels, "watched": "watched" in labels, "_updated_at": now.isoformat()}
    if db.supports_targeted_updates():
        if not db.update_video_fields(plan_id, course_id, module_id, video_id, fields):
            raise HTTPException(status_code=404, detail="Plan, course, module, or video not found")
        return _reloaded_plan(plan_id)
    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    module = next((item for item in course.modules if item.id == module_id), None) if course else None
    video = next((item for item in module.videos if item.video_id == video_id), None) if module else None
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.labels = labels
    video.watched = "watched" in labels
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def update_video_playback(plan_id: str, course_id: str, module_id: str, video_id: str, request: PlaybackUpdateRequest) -> LearningPlan:
    now = _now()
    if db.supports_targeted_updates():
        fields = {
            "last_played_position_secs": request.position_secs,
            "last_played_at": now.isoformat(),
            "_updated_at": now.isoformat(),
            "_course_last_played_video_id": video_id,
            "_course_last_played_position_secs": request.position_secs,
            "_course_last_played_at": now.isoformat(),
        }
        if not db.update_video_fields(plan_id, course_id, module_id, video_id, fields):
            raise HTTPException(status_code=404, detail="Plan, course, module, or video not found")
        return _reloaded_plan(plan_id)
    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    module = next((item for item in course.modules if item.id == module_id), None) if course else None
    video = next((item for item in module.videos if item.video_id == video_id), None) if module else None
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.last_played_position_secs = request.position_secs
    video.last_played_at = now
    course.last_played_video_id = video.video_id
    course.last_played_position_secs = request.position_secs
    course.last_played_at = now
    course.updated_at = now
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def update_plan_progress(
    plan_id: str,
    request: BulkProgressUpdateRequest,
) -> tuple[LearningPlan, int, bool]:
    """Merge a client progress snapshot without replacing plan structure or metadata."""
    plan = _load_plan(plan_id)
    had_remote_changes = bool(
        request.base_updated_at and plan.updated_at > request.base_updated_at
    )
    locations = {}
    for course in plan.courses:
        for module in course.modules:
            for video in module.videos:
                locations[(course.id, module.id, video.video_id)] = (course, video)

    missing = [
        item.video_id
        for item in request.videos
        if (item.course_id, item.module_id, item.video_id) not in locations
    ]
    if missing:
        raise HTTPException(
            status_code=409,
            detail=f"Progress target no longer exists: {', '.join(sorted(set(missing)))}",
        )
    if any(item.watched is None and item.position_secs is None for item in request.videos):
        raise HTTPException(status_code=422, detail="Each progress item must include watched or position_secs")

    now = _now()
    touched_courses = set()
    for item in request.videos:
        course, video = locations[(item.course_id, item.module_id, item.video_id)]
        changed_at = item.changed_at or now
        if item.watched is not None:
            video.watched = item.watched
            labels = [label for label in video.labels if label != "watched"]
            video.labels = [*labels, "watched"] if item.watched else labels
        if item.position_secs is not None:
            video.last_played_position_secs = item.position_secs
            video.last_played_at = changed_at
            course.last_played_video_id = video.video_id
            course.last_played_position_secs = item.position_secs
            course.last_played_at = changed_at
        touched_courses.add(course.id)

    for course in plan.courses:
        if course.id in touched_courses:
            course.updated_at = now
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan, len(request.videos), had_remote_changes


def reorder_course_videos(plan_id: str, course_id: str, request: VideoReorderRequest) -> LearningPlan:
    plan = _load_plan(plan_id)
    course = next((item for item in plan.courses if item.id == course_id), None)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    source_module = next((item for item in course.modules if item.id == request.source_module_id), None)
    target_module = next((item for item in course.modules if item.id == request.target_module_id), None)
    if not source_module or not target_module:
        raise HTTPException(status_code=404, detail="Module not found")
    source_index = next((index for index, video in enumerate(source_module.videos) if video.video_id == request.video_id), None)
    if source_index is None:
        raise HTTPException(status_code=404, detail="Video not found in source module")
    video = source_module.videos.pop(source_index)
    target_index = request.target_index - (1 if source_module.id == target_module.id and source_index < request.target_index else 0)
    target_module.videos.insert(max(0, min(target_index, len(target_module.videos))), video)
    for module in course.modules:
        for index, item in enumerate(module.videos, start=1):
            item.sequence = index
    now = _now()
    course.updated_at = now
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan


def move_plan_videos(plan_id: str, request: VideoBulkMoveRequest) -> tuple[LearningPlan, int]:
    plan = _load_plan(plan_id)
    source_course = next((course for course in plan.courses if course.id == request.source_course_id), None)
    target_course = next((course for course in plan.courses if course.id == request.target_course_id), None)
    if not source_course or not target_course:
        raise HTTPException(status_code=404, detail="Source or destination course not found")
    target_module = next((module for module in target_course.modules if module.id == request.target_module_id), None)
    if not target_module:
        raise HTTPException(status_code=404, detail="Destination module not found")

    requested_ids = list(dict.fromkeys(request.video_ids))
    requested_id_set = set(requested_ids)
    located_videos = [
        video
        for module in source_course.modules
        for video in module.videos
        if video.video_id in requested_id_set
    ]
    located_ids = {video.video_id for video in located_videos}
    missing_ids = requested_id_set - located_ids
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Video not found in source course: {', '.join(sorted(missing_ids))}")

    for module in source_course.modules:
        module.videos = [video for video in module.videos if video.video_id not in requested_id_set]
    target_module.videos.extend(located_videos)

    affected_courses = {source_course.id, target_course.id}
    now = _now()
    for course in plan.courses:
        if course.id not in affected_courses:
            continue
        for module in course.modules:
            for index, video in enumerate(module.videos, start=1):
                video.sequence = index
        course.updated_at = now
    if source_course.last_played_video_id in requested_id_set:
        source_course.last_played_video_id = None
        source_course.last_played_position_secs = None
        source_course.last_played_at = None
    plan.updated_at = now
    db.save_plan(plan.model_dump())
    return plan, len(located_videos)
