#!/bin/bash
# Ollama Lint Check - Simple wrapper for code linting via Ollama
# Usage: ./ollama_lint.sh <file_or_code> [language]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Default model
MODEL=${OLLAMA_LINT_MODEL:-"mistral:latest"}
OLLAMA_URL=${OLLAMA_URL:-"http://localhost:11434"}
TIMEOUT=${OLLAMA_TIMEOUT:-10}

if [ $# -lt 1 ]; then
    echo "Usage: $0 <file_or_code> [language]"
    echo ""
    echo "Examples:"
    echo "  $0 src/index.js javascript"
    echo "  $0 'console.log(test)' javascript"
    exit 1
fi

CODE_INPUT="$1"
LANGUAGE="${2:-javascript}"

# Check if Ollama is running
if ! curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "⚠️  Ollama is not running at $OLLAMA_URL"
    exit 0
fi

# Use Python script for robust handling
python3 "$SCRIPT_DIR/ollama_lint.py" \
    --check "$CODE_INPUT" \
    --language "$LANGUAGE" \
    --url "$OLLAMA_URL" \
    --model-lint "$MODEL" \
    --timeout "$TIMEOUT"
