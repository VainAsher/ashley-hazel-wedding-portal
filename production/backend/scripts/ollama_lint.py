#!/usr/bin/env python3
"""
Ollama Lint CLI - Standalone script for checking code and extracting test summaries.

Usage:
    python scripts/ollama_lint.py --check code.js
    python scripts/ollama_lint.py --check code.py --language python
    python scripts/ollama_lint.py --test pytest_output.txt
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.utils.ollama_lint import (
    check_code_lint,
    extract_test_summary,
    format_lint_report,
    format_test_report,
    check_ollama_available,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Ollama Tier 1: Code lint checking and test summary extraction"
    )
    parser.add_argument(
        "--check",
        type=str,
        help="File or code to lint (reads file if path exists, otherwise treats as code)",
    )
    parser.add_argument(
        "--test",
        type=str,
        help="File with pytest output to extract summary from",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="javascript",
        help="Programming language (javascript, python, sql, etc.)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of human-readable format",
    )
    parser.add_argument(
        "--url",
        type=str,
        default="http://localhost:11434",
        help="Ollama API endpoint",
    )
    parser.add_argument(
        "--model-lint",
        type=str,
        default="mistral:latest",
        help="Ollama model for lint checking",
    )
    parser.add_argument(
        "--model-test",
        type=str,
        default="llama3.2:3b",
        help="Ollama model for test summary",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=10,
        help="Timeout in seconds for Ollama requests",
    )

    args = parser.parse_args()

    # Check if Ollama is available
    if not check_ollama_available(args.url):
        if args.json:
            print(json.dumps({"available": False, "message": "Ollama not available"}))
        else:
            print("❌ Ollama is not available at", args.url)
        return 1

    # Handle lint check
    if args.check:
        code = args.check

        # If looks like a file path, try to read it
        if Path(code).exists() and Path(code).is_file():
            try:
                code = Path(code).read_text()
                logger.info(f"Read code from {args.check}")
            except Exception as e:
                logger.error(f"Failed to read file {args.check}: {e}")
                return 1

        result = check_code_lint(
            code,
            language=args.language,
            model=args.model_lint,
            timeout_seconds=args.timeout,
            url=args.url,
        )

        if result is None:
            if args.json:
                print(json.dumps({"available": False, "message": "Lint check unavailable"}))
            else:
                print("⚠️  Lint check failed (Ollama may be unavailable)")
            return 0  # Don't fail, just skip

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(format_lint_report(result))

        return 1 if result.get("has_issues") and any(
            issue.get("severity") == "error" for issue in result.get("lint_issues", [])
        ) else 0

    # Handle test summary
    elif args.test:
        test_output_file = Path(args.test)
        if not test_output_file.exists():
            logger.error(f"Test output file not found: {args.test}")
            return 1

        try:
            test_output = test_output_file.read_text()
        except Exception as e:
            logger.error(f"Failed to read test output file: {e}")
            return 1

        result = extract_test_summary(
            test_output,
            model=args.model_test,
            timeout_seconds=args.timeout,
            url=args.url,
        )

        if result is None:
            if args.json:
                print(json.dumps({"available": False, "message": "Test extraction unavailable"}))
            else:
                print("⚠️  Test summary extraction failed (Ollama may be unavailable)")
            return 0  # Don't fail, just skip

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(format_test_report(result))

        return 0

    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
