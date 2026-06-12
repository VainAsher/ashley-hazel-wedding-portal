from __future__ import annotations

import re
from typing import Any


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
