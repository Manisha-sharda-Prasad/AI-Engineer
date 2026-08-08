"""Authenticated public gateway for local HTTP or private Lambda services."""

import asyncio
import base64
import json
import time

import httpx
from fastapi import Request
from starlette.responses import Response

from src.y2026.youtube_agent_2.backend.shared.platform import create_app, identity
from src.y2026.youtube_agent_2.backend.services.gateway.app import config
from src.y2026.youtube_agent_2.backend.services.gateway.app.routing import select_upstream


app = create_app(
    service_name="api-gateway",
    title="YouTube Learning Organizer - API Gateway",
    require_identity=True,
)

_lambda_client = None
_dynamodb_client = None

_HOP_BY_HOP_RESPONSE_HEADERS = {
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def _upstream_request_headers(request: Request) -> dict[str, str]:
    headers = {
        name: value
        for name, value in request.headers.items()
        if name.lower() not in {"host", "content-length", "accept-encoding"}
    }
    # httpx only decodes optional Brotli/Zstandard encodings when their extra
    # packages are installed. Asking service-to-service calls for identity
    # prevents encoded bytes from being forwarded as an application/json body.
    headers["Accept-Encoding"] = "identity"
    headers["X-Forwarded-Host"] = request.headers.get("host", "")
    return headers


def _aws_client(service: str):
    global _lambda_client, _dynamodb_client
    import boto3

    if service == "lambda":
        _lambda_client = _lambda_client or boto3.client("lambda")
        return _lambda_client
    _dynamodb_client = _dynamodb_client or boto3.client("dynamodb")
    return _dynamodb_client


def _check_rate_limit(user_id: str) -> bool:
    if not config.RATE_LIMIT_ENABLED or not config.DYNAMODB_TABLE_NAME:
        return True
    minute = int(time.time() // 60)
    try:
        _aws_client("dynamodb").update_item(
            TableName=config.DYNAMODB_TABLE_NAME,
            Key={
                "PK": {"S": f"RATE#{user_id}"},
                "SK": {"S": f"MINUTE#{minute}"},
            },
            UpdateExpression="SET expires_at = :expires ADD #count :one",
            ConditionExpression="attribute_not_exists(#count) OR #count < :limit",
            ExpressionAttributeNames={"#count": "request_count"},
            ExpressionAttributeValues={
                ":one": {"N": "1"},
                ":limit": {"N": str(config.RATE_LIMIT_REQUESTS_PER_MINUTE)},
                ":expires": {"N": str((minute + 2) * 60)},
            },
        )
        return True
    except _aws_client("dynamodb").exceptions.ConditionalCheckFailedException:
        return False


def _invoke_private_lambda(
    service_name: str, request: Request, body: bytes
) -> tuple[bytes, int, dict[str, str], str | None]:
    function_name = {
        "youtube-service": config.YOUTUBE_FUNCTION_NAME,
        "plans-service": config.PLANS_FUNCTION_NAME,
    }[service_name]
    if not function_name:
        raise RuntimeError(f"Lambda function is not configured for {service_name}")
    forwarded_headers = {
        name: value
        for name, value in request.headers.items()
        if name.lower() in {"content-type", "x-youtube-access-token"}
    }
    event = {
        "source": "youtube-agent.gateway",
        "user_id": identity.require_current_user(),
        "request_id": request.headers.get("x-request-id", "internal"),
        "request": {
            "method": request.method,
            "path": request.url.path,
            "query": request.url.query,
            "headers": forwarded_headers,
            "body": base64.b64encode(body).decode("ascii"),
            "isBase64Encoded": True,
        },
    }
    result = _aws_client("lambda").invoke(
        FunctionName=function_name,
        InvocationType="RequestResponse",
        Payload=json.dumps(event).encode("utf-8"),
    )
    payload = json.loads(result["Payload"].read())
    if result.get("FunctionError"):
        raise RuntimeError(payload.get("errorMessage", f"{service_name} failed"))
    response_body = payload.get("body") or ""
    content = (
        base64.b64decode(response_body)
        if payload.get("isBase64Encoded")
        else response_body.encode("utf-8")
    )
    headers = payload.get("headers", {})
    return content, int(payload.get("statusCode", 500)), headers, headers.get("content-type")


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    include_in_schema=False,
)
async def proxy(path: str, request: Request):
    public_path = f"/{path}"
    service_name, base_url = select_upstream(public_path)
    if not base_url:
        return Response(
            content=b'{"detail":"Route not found"}',
            status_code=404,
            media_type="application/json",
        )

    user_id = identity.require_current_user()
    if not await asyncio.to_thread(_check_rate_limit, user_id):
        return Response(
            content=b'{"detail":"Rate limit exceeded"}',
            status_code=429,
            headers={"Retry-After": "60"},
            media_type="application/json",
        )

    body = await request.body()
    if config.DOWNSTREAM_INVOKE_MODE == "lambda":
        try:
            content, status, response_headers, media_type = await asyncio.to_thread(
                _invoke_private_lambda, service_name, request, body
            )
        except Exception:
            return Response(
                content=(f'{{"detail":"{service_name} unavailable"}}').encode(),
                status_code=503,
                media_type="application/json",
            )
        return Response(
            content=content,
            status_code=status,
            headers={
                name: value
                for name, value in response_headers.items()
                if name.lower() not in _HOP_BY_HOP_RESPONSE_HEADERS
            },
            media_type=media_type,
        )

    target_url = f"{base_url}{public_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"
    request_headers = _upstream_request_headers(request)
    request_headers["X-Gateway-Service"] = service_name

    try:
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=config.REQUEST_TIMEOUT_SECS
        ) as client:
            upstream = await client.request(
                request.method,
                target_url,
                headers=request_headers,
                content=body,
            )
    except httpx.RequestError:
        return Response(
            content=(
                '{"detail":"%s unavailable"}' % service_name
            ).encode("utf-8"),
            status_code=503,
            media_type="application/json",
        )

    response_headers = {
        name: value
        for name, value in upstream.headers.items()
        if name.lower() not in _HOP_BY_HOP_RESPONSE_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
