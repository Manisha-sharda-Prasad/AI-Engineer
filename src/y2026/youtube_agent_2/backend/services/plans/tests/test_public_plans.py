import gc
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from src.y2026.youtube_agent_2.backend.services.plans.app import config
from src.y2026.youtube_agent_2.backend.services.plans.app.main import app
from src.y2026.youtube_agent_2.backend.services.plans.app.models import (
    Channel,
    Course,
    LearningPlan,
    Module,
    NewVideoFeed,
    Video,
)
from src.y2026.youtube_agent_2.backend.services.plans.app.repositories import store
from src.y2026.youtube_agent_2.backend.shared.platform import settings


def _video(video_id: str, *, watched: bool = False) -> Video:
    return Video(
        video_id=video_id,
        title=f"Video {video_id}",
        revised_title_from_ai=f"Revised {video_id}",
        description="Public lesson description",
        url=f"https://www.youtube.com/watch?v={video_id}",
        thumbnail=f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        watched=watched,
        labels=["bookmarked"],
        last_played_position_secs=42,
    )


class PublicPlanRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = config.DB_PATH
        self.original_firestore_store = store._firestore_store
        self.original_internal_token = settings.INTERNAL_SERVICE_TOKEN
        settings.INTERNAL_SERVICE_TOKEN = "test-service-secret"
        config.DB_PATH = Path(self.temp_dir.name) / "public-plan-test.sqlite3"
        store._firestore_store = None
        store.init_store()

        private_video = _video("private-video", watched=True)
        feed_video = _video("feed-video")
        plan = LearningPlan(
            id="plan-1",
            name="Distributed systems",
            labels=["architecture", "bookmarked"],
            courses=[Course(
                id="course-1",
                title="Consensus",
                labels=["systems", "watched", "refresh_needed"],
                last_played_video_id=private_video.video_id,
                last_played_position_secs=42,
                source_channels=[Channel(
                    channel_id="secret-channel",
                    title="Private source",
                    url="https://youtube.com/@private-source",
                )],
                new_video_feeds=[NewVideoFeed(
                    channel_id="secret-channel",
                    videos=[feed_video],
                )],
                modules=[Module(
                    id="module-1",
                    title="Leader election",
                    labels=["core", "mark_for_delete"],
                    videos=[private_video],
                )],
            )],
        )
        store.save_plan(plan.model_dump())

        self.owner = TestClient(app)
        self.owner.headers.update({
            "X-Internal-Service-Token": "test-service-secret",
            "X-Internal-User-ID": "firebase-user-1",
        })
        self.anonymous = TestClient(app)

    def tearDown(self):
        self.owner.close()
        self.anonymous.close()
        store._firestore_store = self.original_firestore_store
        settings.INTERNAL_SERVICE_TOKEN = self.original_internal_token
        config.DB_PATH = self.original_db_path
        gc.collect()
        self.temp_dir.cleanup()

    def test_anonymous_read_returns_only_the_public_projection(self):
        published = self.owner.post("/api/plans/plan-1/publication")
        self.assertEqual(published.status_code, 200)
        share_id = published.json()["share_id"]

        gallery_response = self.anonymous.get("/public-api/plans")
        self.assertEqual(gallery_response.status_code, 200)
        gallery = gallery_response.json()["plans"]
        self.assertEqual(len(gallery), 1)
        self.assertEqual(gallery[0]["share_id"], share_id)
        self.assertEqual(gallery[0]["plan_id"], "plan-1")
        self.assertEqual(gallery[0]["course_count"], 1)
        self.assertEqual(gallery[0]["module_count"], 1)
        self.assertEqual(gallery[0]["video_count"], 1)
        self.assertNotIn("courses", gallery[0])

        response = self.anonymous.get(f"/public-api/plans/{share_id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "public, max-age=60")
        public_plan = response.json()
        self.assertNotIn("id", public_plan)
        self.assertEqual(public_plan["labels"], ["architecture"])
        course = public_plan["courses"][0]
        self.assertEqual(course["labels"], ["systems"])
        self.assertNotIn("source_channels", course)
        self.assertNotIn("new_video_feeds", course)
        self.assertNotIn("last_played_video_id", course)
        self.assertNotIn("last_played_position_secs", course)
        module = course["modules"][0]
        self.assertEqual(module["labels"], ["core"])
        video = module["videos"][0]
        self.assertNotIn("watched", video)
        self.assertNotIn("labels", video)
        self.assertNotIn("last_played_position_secs", video)
        self.assertNotIn("last_played_at", video)
        head = self.anonymous.head(f"/public-api/plans/{share_id}")
        self.assertEqual(head.status_code, 200)
        self.assertEqual(head.headers["cache-control"], "public, max-age=60")

    def test_owner_edits_refresh_the_public_projection(self):
        published = self.owner.post("/api/plans/plan-1/publication").json()
        share_id = published["share_id"]

        updated = self.owner.patch(
            "/api/plans/plan-1",
            json={"name": "Updated distributed systems"},
        )

        self.assertEqual(updated.status_code, 200)
        public_plan = self.anonymous.get(f"/public-api/plans/{share_id}").json()
        self.assertEqual(public_plan["name"], "Updated distributed systems")

    def test_publish_is_idempotent_and_unpublish_revokes_the_link(self):
        first = self.owner.post("/api/plans/plan-1/publication")
        second = self.owner.post("/api/plans/plan-1/publication")
        self.assertEqual(first.json()["share_id"], second.json()["share_id"])
        share_id = first.json()["share_id"]

        unpublished = self.owner.delete("/api/plans/plan-1/publication")

        self.assertEqual(unpublished.status_code, 200)
        self.assertEqual(unpublished.json()["plan"]["visibility"], "private")
        self.assertEqual(
            self.anonymous.get(f"/public-api/plans/{share_id}").status_code,
            404,
        )
        self.assertEqual(self.anonymous.get("/public-api/plans").json()["plans"], [])

    def test_private_plan_and_public_mutations_are_not_anonymous(self):
        self.assertEqual(self.anonymous.get("/api/plans/plan-1").status_code, 401)
        self.assertEqual(
            self.anonymous.post("/api/plans/plan-1/publication").status_code,
            401,
        )
        self.assertEqual(
            self.anonymous.get("/public-api/plans/not-a-share").status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main()
