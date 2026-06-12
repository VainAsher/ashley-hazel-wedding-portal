from __future__ import annotations

import re
import time
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import HTTPException, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

from app.config import Settings
from app.logging import get_logger


logger = get_logger(__name__)

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint", "status"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 2.5, 5.0),
)
HTTP_ACTIVE_REQUESTS = Gauge(
    "http_active_requests",
    "Currently active HTTP requests",
)

_NOISY_SLOW_ENDPOINTS = {"/health", "/metrics"}
_WHITESPACE_PATTERN = re.compile(r"\s+")
_STRING_LITERAL_PATTERN = re.compile(r"'[^']*'|\"[^\"]*\"")
_NUMBER_LITERAL_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\b")


def endpoint_label(request: Any) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if route_path:
        return str(route_path)
    return str(request.url.path)


def sql_operation(statement: str | None) -> str:
    if not statement:
        return "UNKNOWN"

    stripped = statement.strip()
    if not stripped:
        return "UNKNOWN"

    first_token = stripped.split(None, 1)[0].upper()
    if not first_token.isalpha():
        return "UNKNOWN"
    return first_token


def statement_summary(statement: str | None, max_length: int = 120) -> str:
    operation = sql_operation(statement)
    if not statement:
        return operation

    normalized = _WHITESPACE_PATTERN.sub(" ", statement).strip()
    sanitized = _STRING_LITERAL_PATTERN.sub("?", normalized)
    sanitized = _NUMBER_LITERAL_PATTERN.sub("?", sanitized)
    if len(sanitized) > max_length:
        sanitized = sanitized[: max_length - 3].rstrip() + "..."
    return sanitized or operation


def observe_request(
    method: str,
    endpoint: str,
    status: int | str,
    duration_seconds: float,
    settings: Settings,
) -> None:
    if not settings.metrics_enabled:
        return

    status_label = str(status)
    HTTP_REQUESTS_TOTAL.labels(
        method=method,
        endpoint=endpoint,
        status=status_label,
    ).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(
        method=method,
        endpoint=endpoint,
        status=status_label,
    ).observe(duration_seconds)

    duration_ms = duration_seconds * 1000
    if (
        endpoint not in _NOISY_SLOW_ENDPOINTS
        and duration_ms >= settings.slow_request_threshold_ms
    ):
        logger.warning(
            "slow_http_request",
            extra={
                "duration_ms": round(duration_ms, 3),
                "endpoint": endpoint,
                "method": method,
                "status": status_label,
                "threshold_ms": settings.slow_request_threshold_ms,
            },
        )


def metrics_middleware(
    settings: Settings,
) -> Callable[
    [Request, Callable[[Request], Awaitable[Response]]],
    Awaitable[Response],
]:
    async def middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not settings.metrics_enabled:
            return await call_next(request)

        start_time = time.perf_counter()
        status_code = 500
        HTTP_ACTIVE_REQUESTS.inc()
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            try:
                observe_request(
                    request.method,
                    endpoint_label(request),
                    status_code,
                    time.perf_counter() - start_time,
                    settings,
                )
            finally:
                HTTP_ACTIVE_REQUESTS.dec()

    return middleware


def metrics_response(settings: Settings) -> Response:
    if not settings.metrics_enabled:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
