import unittest

from src.y2026.youtube_agent_2.backend.services.youtube.app.main import app


class YouTubeRouteTests(unittest.TestCase):
    def test_service_exposes_catalog_but_not_plan_routes(self):
        paths = set(app.openapi()["paths"])
        self.assertIn("/api/channels", paths)
        self.assertNotIn("/auth/google/callback", paths)
        self.assertNotIn("/api/integrations/youtube/connect", paths)
        self.assertNotIn("/api/plans", paths)


if __name__ == "__main__":
    unittest.main()
