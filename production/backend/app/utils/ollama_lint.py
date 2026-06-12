"""
Ollama Tier 1 Integration: Optional lint checking and test summary extraction.

This module provides helper functions for optional Ollama-based code analysis.
It's designed to be fail-safe—if Ollama is unavailable, it gracefully continues.

Usage:
    from app.utils.ollama_lint import check_code_lint, extract_test_summary

    # Lint a code snippet
    result = check_code_lint("console.log('test')")
    if result and result.get("has_issues"):
        print(result["lint_issues"])

    # Extract test summary from pytest output
    summary = extract_test_summary(pytest_output_text)
    if summary:
        print(f"Passed: {summary['passed']}, Failed: {summary['failed']}")
"""

import json
import logging
import subprocess
from typing import Optional, Dict, Any, List
from urllib.error import URLError

logger = logging.getLogger(__name__)

# Ollama defaults
DEFAULT_OLLAMA_URL = "http://localhost:11434"
LINT_MODEL = "mistral:latest"
TEST_MODEL = "llama3.2:3b"
TIMEOUT_SECONDS = 10


def check_ollama_available(url: str = DEFAULT_OLLAMA_URL) -> bool:
    """
    Check if Ollama is running and available.

    Args:
        url: Ollama API endpoint (default: http://localhost:11434)

    Returns:
        True if Ollama is reachable, False otherwise
    """
    try:
        import urllib.request
        urllib.request.urlopen(f"{url}/api/tags", timeout=2)
        logger.debug("Ollama is available")
        return True
    except (URLError, Exception) as e:
        logger.debug(f"Ollama unavailable: {e}")
        return False


def check_code_lint(
    code: str,
    language: str = "javascript",
    model: str = LINT_MODEL,
    timeout_seconds: int = TIMEOUT_SECONDS,
    url: str = DEFAULT_OLLAMA_URL,
) -> Optional[Dict[str, Any]]:
    """
    Use Ollama to check code for lint issues (optional, best-effort).

    Detects:
    - console.log/debug/warn/error statements
    - unused imports
    - TODO/FIXME comments
    - debugger statements
    - hardcoded secrets

    Args:
        code: Source code to analyze
        language: Programming language (javascript, python, etc.)
        model: Ollama model to use
        timeout_seconds: Timeout for Ollama request
        url: Ollama API endpoint

    Returns:
        Dict with "lint_issues", "has_issues", "total_issues" if successful
        None if Ollama unavailable or request fails
    """
    if not code or not code.strip():
        return None

    if not check_ollama_available(url):
        logger.info("Ollama not available, skipping lint check")
        return None

    prompt = f"""You are a code quality analyzer. Analyze the provided {language} code and identify obvious quality issues.

ONLY report issues that are CLEARLY present. Do not guess or speculate.

Report in this exact JSON format (no extra text):
{{
  "lint_issues": [
    {{
      "type": "console_log|unused_import|todo_comment|debugger|hardcoded_secret",
      "line": <line_number or null if unknown>,
      "code": "actual_code_snippet",
      "severity": "error|warning"
    }}
  ],
  "has_issues": <true|false>,
  "total_issues": <count>
}}

RULES:
- console.log, console.warn, console.error → type: "console_log"
- import/require statements that are never used → type: "unused_import"
- // TODO, // FIXME, # TODO, # FIXME → type: "todo_comment"
- debugger statement → type: "debugger"
- hardcoded passwords, API keys, tokens → type: "hardcoded_secret" (severity: "error")
- Only report if 100% confident
- If uncertain, omit it

CODE TO ANALYZE:
{code}

Respond ONLY with valid JSON, no other text."""

    try:
        # Use curl to invoke Ollama API (more reliable than Python client)
        cmd = [
            "curl",
            "-s",
            f"{url}/api/generate",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json",
            "-d",
            json.dumps({
                "model": model,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.1,
                "num_predict": 500,
            }),
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        if result.returncode != 0:
            logger.warning(f"Ollama curl failed: {result.stderr}")
            return None

        # Extract response from curl output
        try:
            response_json = json.loads(result.stdout)
            response_text = response_json.get("response", "").strip()
        except json.JSONDecodeError:
            logger.warning("Failed to parse Ollama response as JSON")
            return None

        if not response_text:
            logger.warning("Ollama returned empty response")
            return None

        # Parse the lint output
        try:
            lint_result = json.loads(response_text)

            # Validate structure
            required_keys = {"lint_issues", "has_issues", "total_issues"}
            if not all(k in lint_result for k in required_keys):
                logger.warning("Ollama response missing required keys")
                return None

            logger.info(f"Lint check complete: {lint_result['total_issues']} issues found")
            return lint_result

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse lint output as JSON: {e}")
            logger.debug(f"Raw response: {response_text}")
            return None

    except subprocess.TimeoutExpired:
        logger.warning(f"Ollama lint check timed out after {timeout_seconds}s")
        return None
    except Exception as e:
        logger.warning(f"Ollama lint check failed: {e}")
        return None


def extract_test_summary(
    test_output: str,
    model: str = TEST_MODEL,
    timeout_seconds: int = TIMEOUT_SECONDS,
    url: str = DEFAULT_OLLAMA_URL,
) -> Optional[Dict[str, Any]]:
    """
    Use Ollama to extract test summary from pytest output (optional, best-effort).

    Extracts:
    - Number of passed tests
    - Number of failed tests
    - Number of skipped tests
    - Total duration

    Args:
        test_output: Raw pytest output text
        model: Ollama model to use (3B model recommended for speed)
        timeout_seconds: Timeout for Ollama request
        url: Ollama API endpoint

    Returns:
        Dict with "passed", "failed", "skipped", "duration_seconds" if successful
        None if Ollama unavailable or request fails
    """
    if not test_output or not test_output.strip():
        return None

    if not check_ollama_available(url):
        logger.info("Ollama not available, skipping test summary extraction")
        return None

    prompt = f"""Extract test summary from pytest output. Report ONLY the numbers.

Respond in this exact JSON format (no extra text):
{{
  "passed": <number>,
  "failed": <number>,
  "skipped": <number>,
  "duration_seconds": <number or null>
}}

PYTEST OUTPUT:
{test_output}

Respond ONLY with valid JSON, no other text."""

    try:
        cmd = [
            "curl",
            "-s",
            f"{url}/api/generate",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json",
            "-d",
            json.dumps({
                "model": model,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.0,  # Deterministic output for extraction
                "num_predict": 200,
            }),
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        if result.returncode != 0:
            logger.warning(f"Ollama curl failed: {result.stderr}")
            return None

        # Extract response
        try:
            response_json = json.loads(result.stdout)
            response_text = response_json.get("response", "").strip()
        except json.JSONDecodeError:
            logger.warning("Failed to parse Ollama response as JSON")
            return None

        if not response_text:
            logger.warning("Ollama returned empty response")
            return None

        # Parse the summary
        try:
            summary = json.loads(response_text)

            # Validate structure
            required_keys = {"passed", "failed", "skipped", "duration_seconds"}
            if not all(k in summary for k in required_keys):
                logger.warning("Test summary missing required keys")
                return None

            logger.info(f"Test summary: {summary['passed']} passed, {summary['failed']} failed")
            return summary

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse test summary as JSON: {e}")
            logger.debug(f"Raw response: {response_text}")
            return None

    except subprocess.TimeoutExpired:
        logger.warning(f"Test summary extraction timed out after {timeout_seconds}s")
        return None
    except Exception as e:
        logger.warning(f"Test summary extraction failed: {e}")
        return None


def format_lint_report(lint_result: Dict[str, Any]) -> str:
    """
    Format lint result as human-readable text.

    Args:
        lint_result: Output from check_code_lint()

    Returns:
        Formatted text report
    """
    if not lint_result or not lint_result.get("has_issues"):
        return "✅ No lint issues found"

    report = f"⚠️  Lint Issues ({lint_result['total_issues']} found):\n\n"

    for issue in lint_result.get("lint_issues", []):
        severity = "🔴" if issue.get("severity") == "error" else "⚠️ "
        line = issue.get("line", "?")
        report += f"{severity} [{issue.get('type')}] Line {line}: {issue.get('code', '')}\n"

    return report


def format_test_report(summary: Dict[str, Any]) -> str:
    """
    Format test summary as human-readable text.

    Args:
        summary: Output from extract_test_summary()

    Returns:
        Formatted text report
    """
    if not summary:
        return "Test summary unavailable"

    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)
    skipped = summary.get("skipped", 0)
    duration = summary.get("duration_seconds")

    status = "✅" if failed == 0 else "❌"
    report = f"{status} Tests: {passed} passed, {failed} failed, {skipped} skipped"

    if duration:
        report += f" ({duration:.1f}s)"

    return report
