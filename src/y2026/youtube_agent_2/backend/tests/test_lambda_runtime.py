import base64
import unittest

from src.y2026.youtube_agent_2.backend.shared.platform.lambda_runtime import _internal_http_event


class LambdaRuntimeTests(unittest.TestCase):
    def test_internal_event_adds_unforgeable_user_context(self):
        event = _internal_http_event({
            "source": "youtube-agent.gateway",
            "user_id": "firebase-user",
            "request": {
                "method": "POST",
                "path": "/api/plans",
                "query": "draft=true",
                "headers": {"X-YouTube-Access-Token": "short-lived"},
                "body": base64.b64encode(b"{}").decode(),
                "isBase64Encoded": True,
            },
        })

        self.assertEqual(event["requestContext"]["authorizer"]["lambda"]["userId"], "firebase-user")
        self.assertTrue(event["isBase64Encoded"])
        self.assertEqual(event["body"], "e30=")

    def test_public_internal_event_does_not_invent_an_identity(self):
        event = _internal_http_event({
            "source": "youtube-agent.gateway",
            "request": {
                "method": "GET",
                "path": "/public-api/plans/opaque-share-id",
                "headers": {},
            },
        })

        self.assertNotIn("authorizer", event["requestContext"])
        self.assertEqual(event["rawPath"], "/public-api/plans/opaque-share-id")
