from __future__ import annotations

import re
from collections.abc import Iterable


class SecretMasker:
    """Mask sensitive values before they reach logs or error text."""

    REDACTION = "***REDACTED***"
    PATTERNS: tuple[re.Pattern[str], ...] = (
        re.compile(r"(postgres(?:ql)?://[^:\s/@]+:)([^@\s]+)(@)", re.IGNORECASE),
        re.compile(r"((?:password|secret|token|api[_-]?key|jwt)[\"'\s:=]+)([^\"'\s,;]+)", re.IGNORECASE),
        re.compile(r"\b(sk-[A-Za-z0-9_\-]{8,})\b"),
        re.compile(r"\b(eyJ[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+)\b"),
    )

    @classmethod
    def mask(cls, value: object) -> str:
        text = str(value)
        for pattern in cls.PATTERNS:
            if pattern.groups >= 3:
                text = pattern.sub(rf"\1{cls.REDACTION}\3", text)
            elif pattern.groups == 2:
                text = pattern.sub(rf"\1{cls.REDACTION}", text)
            else:
                text = pattern.sub(cls.REDACTION, text)
        return text

    @classmethod
    def contains_unmasked_secret(cls, text: str, secrets: Iterable[str]) -> bool:
        return any(secret and secret in text for secret in secrets)
