import unittest
from unittest.mock import Mock, patch
import json

from src.y2026.youtube_agent_2.backend.services.gateway.app.main import (
    _invoke_private_lambda,
    _upstream_request_headers,
)
from src.y2026.youtube_agent_2.backend.shared.platform import identity


class GatewayProxyHeaderTests(unittest.TestCase):
    def test_requests_uncompressed_upstream_response(self):
        request = Mock()
        request.headers = {
            "host": "youtube-learning-gateway.onrender.com",
            "accept-encoding": "gzip, deflate, br, zstd",
            "authorization": "Bearer firebase-token",
        }

        headers = _upstream_request_headers(request)

        self.assertEqual(headers["Accept-Encoding"], "identity")
        self.assertEqual(
            headers["X-Forwarded-Host"],
            "youtube-learning-gateway.onrender.com",
        )
        self.assertEqual(headers["authorization"], "Bearer firebase-token")
        self.assertNotIn("accept-encoding", headers)

    def test_private_invoke_forwards_only_request_scoped_youtube_token(self):
        request = Mock()
        request.method = "GET"
        request.url.path = "/api/channels"
        request.url.query = ""
        request.headers = {
            "authorization": "Bearer firebase-id-token",
            "x-youtube-access-token": "youtube-access-token",
            "content-type": "application/json",
        }
        payload_stream = Mock()
        payload_stream.read.return_value = json.dumps({
            "statusCode": 200,
            "headers": {"content-type": "application/json"},
            "body": '{"channels":[]}',
        }).encode()
        lambda_client = Mock()
        lambda_client.invoke.return_value = {"Payload": payload_stream}
        context = identity.set_current_user("firebase-user")
        try:
            with (
                patch("src.y2026.youtube_agent_2.backend.services.gateway.app.main._aws_client", return_value=lambda_client),
                patch("src.y2026.youtube_agent_2.backend.services.gateway.app.main.config.YOUTUBE_FUNCTION_NAME", "youtube-function"),
            ):
                content, status, _, _ = _invoke_private_lambda(
                    "youtube-service", request, b""
                )
        finally:
            identity.reset_current_user(context)

        event = json.loads(lambda_client.invoke.call_args.kwargs["Payload"])
        self.assertEqual(event["user_id"], "firebase-user")
        self.assertEqual(
            event["request"]["headers"]["x-youtube-access-token"],
            "youtube-access-token",
        )
        self.assertNotIn("authorization", event["request"]["headers"])
        self.assertEqual((status, content), (200, b'{"channels":[]}'))


if __name__ == "__main__":
    unittest.main()
