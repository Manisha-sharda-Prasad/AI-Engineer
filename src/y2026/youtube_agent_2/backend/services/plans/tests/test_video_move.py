import unittest
from unittest.mock import patch

from fastapi import HTTPException

from src.y2026.youtube_agent_2.backend.services.plans.app.domain import plans
from src.y2026.youtube_agent_2.backend.services.plans.app.models import VideoBulkMoveRequest


def video(video_id: str, sequence: int) -> dict:
    return {
        "video_id": video_id,
        "title": video_id,
        "revised_title_from_ai": video_id,
        "thumbnail": "",
        "sequence": sequence,
    }


def plan_data() -> dict:
    return {
        "id": "plan-1",
        "name": "Plan",
        "courses": [
            {
                "id": "course-a",
                "title": "Course A",
                "source_channels": [],
                "last_played_video_id": "v2",
                "last_played_position_secs": 12,
                "modules": [
                    {"id": "module-a1", "title": "A1", "videos": [video("v1", 1), video("v2", 2)]},
                    {"id": "module-a2", "title": "A2", "videos": [video("v3", 1)]},
                ],
            },
            {
                "id": "course-b",
                "title": "Course B",
                "source_channels": [],
                "modules": [
                    {"id": "module-b1", "title": "B1", "videos": [video("v4", 1)]},
                ],
            },
        ],
    }


class VideoMoveTests(unittest.TestCase):
    @patch.object(plans.db, "save_plan")
    @patch.object(plans.db, "load_plan")
    def test_moves_selected_videos_to_another_course_and_resequences(self, load_plan, save_plan):
        load_plan.return_value = plan_data()

        result, moved_count = plans.move_plan_videos(
            "plan-1",
            VideoBulkMoveRequest(
                video_ids=["v2", "v3"],
                source_course_id="course-a",
                target_course_id="course-b",
                target_module_id="module-b1",
            ),
        )

        source, target = result.courses
        self.assertEqual(moved_count, 2)
        self.assertEqual([item.video_id for item in source.modules[0].videos], ["v1"])
        self.assertEqual(source.modules[0].videos[0].sequence, 1)
        self.assertEqual(source.modules[1].videos, [])
        self.assertEqual([item.video_id for item in target.modules[0].videos], ["v4", "v2", "v3"])
        self.assertEqual([item.sequence for item in target.modules[0].videos], [1, 2, 3])
        self.assertIsNone(source.last_played_video_id)
        save_plan.assert_called_once()

    @patch.object(plans.db, "save_plan")
    @patch.object(plans.db, "load_plan")
    def test_rejects_missing_video_without_saving(self, load_plan, save_plan):
        load_plan.return_value = plan_data()

        with self.assertRaises(HTTPException) as raised:
            plans.move_plan_videos(
                "plan-1",
                VideoBulkMoveRequest(
                    video_ids=["v2", "missing"],
                    source_course_id="course-a",
                    target_course_id="course-b",
                    target_module_id="module-b1",
                ),
            )

        self.assertEqual(raised.exception.status_code, 404)
        save_plan.assert_not_called()


if __name__ == "__main__":
    unittest.main()
