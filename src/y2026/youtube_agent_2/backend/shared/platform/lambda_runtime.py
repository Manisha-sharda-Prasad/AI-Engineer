"""Mangum adapters for Function URLs and IAM-protected service invocation."""

from __future__ import annotations

import base64
from typing import Any

def _internal_http_event(event: dict[str, Any]) -> dict[str, Any]:
    request = event.get("request", {})
    body = request.get("body", b"")
    if isinstance(body, bytes):
        body = base64.b64encode(body).decode("ascii")
        is_base64 = True
    else:
        is_base64 = bool(request.get("isBase64Encoded", False))
    return {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": request.get("path", "/"),
        "rawQueryString": request.get("query", ""),
        "headers": request.get("headers", {}),
        "requestContext": {
            "authorizer": {"lambda": {"userId": event["user_id"]}},
            "domainName": "internal.lambda",
            "http": {
                "method": request.get("method", "GET"),
                "path": request.get("path", "/"),
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "youtube-agent-gateway",
            },
            "requestId": event.get("request_id", "internal"),
            "stage": "$default",
            "time": "",
            "timeEpoch": 0,
        },
        "body": body or None,
        "isBase64Encoded": is_base64,
    }


class LambdaApplication:
    def __init__(self, app):
        from mangum import Mangum

        self._adapter = Mangum(app, lifespan="off")

    def __call__(self, event, context):
        if event.get("source") == "youtube-agent.gateway":
            event = _internal_http_event(event)
        return self._adapter(event, context)
