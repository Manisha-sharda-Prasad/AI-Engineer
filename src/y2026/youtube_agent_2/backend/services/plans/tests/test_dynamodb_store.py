import unittest

from src.y2026.youtube_agent_2.backend.services.plans.app.repositories.dynamodb_store import DynamoDBStore


class DynamoDBStoreShapeTests(unittest.TestCase):
    def setUp(self):
        self.store = object.__new__(DynamoDBStore)
        self.items = []
        self.store._replace_prefix = lambda user_id, prefix, items: self.items.extend(
            {"PK": f"USER#{user_id}", **item} for item in items
        )
        self.store._query_prefix = lambda user_id, prefix: [
            item for item in self.items if item["PK"] == f"USER#{user_id}" and item["SK"].startswith(prefix)
        ]

    def test_plan_round_trip_rebuilds_normalized_children(self):
        plan = {
            "id": "plan#1",
            "name": "AWS",
            "updated_at": "2026-08-01T00:00:00Z",
            "courses": [{
                "id": "course-1",
                "title": "Serverless",
                "sequence": 1,
                "source_channels": [{
                    "channel_id": "channel-1",
                    "title": "Channel",
                    "playlists": [{"playlist_id": "playlist-1", "title": "Playlist"}],
                }],
                "new_video_feeds": [{
                    "channel_id": "channel-1",
                    "videos": [{"video_id": "feed-video", "title": "Feed"}],
                }],
                "modules": [{
                    "id": "module-1",
                    "title": "Module",
                    "sequence": 1,
                    "videos": [{"video_id": "video-1", "title": "Video", "sequence": 1}],
                }],
            }],
        }

        self.store.save_plan(plan, "user-1")
        loaded = self.store.load_plan("plan#1", "user-1")

        self.assertEqual(loaded, plan)
        self.assertGreater(len(self.items), 5)

    def test_sync_round_trip_splits_pending_videos(self):
        metadata = {
            "updated_at": "2026-08-01T00:00:00Z",
            "channels": [{
                "channel_id": "channel-1",
                "title": "Channel",
                "new_videos": [{"video_id": "channel-video"}],
                "playlists": [{
                    "playlist_id": "playlist-1",
                    "title": "Playlist",
                    "new_videos": [{"video_id": "playlist-video"}],
                }],
            }],
        }

        self.store.save_source_sync_metadata(metadata, "user-1")

        self.assertEqual(self.store.load_source_sync_metadata("user-1"), metadata)
