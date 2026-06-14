# Ollama Tier 1 Implementation - Lint & Test Summary

**Status:** Ready for Codex Integration  
**Date:** 2026-06-11  
**Models Available:** llama3.2:3b, mistral:latest, starcoder2:7b  
**Fallback Strategy:** Strict validation + skip on failure

---

## 🎯 Tier 1 Tasks (Two Functions)

### **Task 1A: Code Lint Check**
### **Task 1B: Test Summary Extraction**

---

## 📝 OLLAMA PROMPT 1: CODE LINT CHECK

### Purpose
Detect obvious code quality issues: console.logs, unused imports, TODO comments, debugging statements.

### Model Selection
**Recommended:** `mistral:latest` (good balance of speed + quality)  
**Fallback:** `llama3.2:3b` (faster but less accurate)  
**Code-optimized:** `starcoder2:7b` (best for code patterns)

### Prompt

```
You are a code quality analyzer. Analyze the provided code and identify obvious quality issues.

ONLY report issues that are CLEARLY present. Do not guess or speculate.

Report in this exact JSON format (no extra text):
{
  "lint_issues": [
    {
      "type": "console_log|unused_import|todo_comment|debugger|hardcoded_secret",
      "line": <line_number or null if unknown>,
      "code": "actual_code_snippet",
      "severity": "error|warning"
    }
  ],
  "has_issues": <true|false>,
  "total_issues": <count>
}

RULES:
- console.log, console.warn, console.error → type: "console_log"
- import X from Y that's never used → type: "unused_import"
- // TODO, // FIXME → type: "todo_comment"
- debugger statement → type: "debugger"
- hardcoded passwords, API keys → type: "hardcoded_secret" (severity: "error")
- Only report if 100% confident
- If uncertain, omit it

CODE TO ANALYZE:
[CODE_HERE]

Respond ONLY with valid JSON, no other text.
```

### Implementation (Python/Bash for Codex)

```bash
#!/bin/bash
# ollama_lint_check.sh

CODE="$1"
MODEL="${2:-mistral:latest}"

PROMPT="You are a code quality analyzer. Analyze the provided code and identify obvious quality issues.

ONLY report issues that are CLEARLY present. Do not guess or speculate.

Report in this exact JSON format (no extra text):
{
  \"lint_issues\": [
    {
      \"type\": \"console_log|unused_import|todo_comment|debugger|hardcoded_secret\",
      \"line\": <line_number or null if unknown>,
      \"code\": \"actual_code_snippet\",
      \"severity\": \"error|warning\"
    }
  ],
  \"has_issues\": <true|false>,
  \"total_issues\": <count>
}

RULES:
- console.log, console.warn, console.error → type: \"console_log\"
- import X from Y that's never used → type: \"unused_import\"
- // TODO, // FIXME → type: \"todo_comment\"
- debugger statement → type: \"debugger\"
- hardcoded passwords, API keys → type: \"hardcoded_secret\" (severity: \"error\")
- Only report if 100% confident
- If uncertain, omit it

CODE TO ANALYZE:
$CODE

Respond ONLY with valid JSON, no other text."

RESPONSE=$(curl -s http://localhost:11434/api/generate \
  -d "{
    \"model\": \"$MODEL\",
    \"prompt\": $(echo "$PROMPT" | jq -Rs .),
    \"stream\": false,
    \"temperature\": 0.1
  }" | jq -r '.response')

echo "$RESPONSE"
```

### Validation Logic

```python
import json

def validate_lint_output(response_text: str) -> dict:
    """
    Validate Ollama lint check output.
    
    Returns:
    - {"valid": True, "data": {...}} if JSON is valid
    - {"valid": False, "error": "..."} if invalid
    """
    try:
        # Extract JSON from response
        data = json.loads(response_text)
        
        # Validate structure
        required_keys = {"lint_issues", "has_issues", "total_issues"}
        if not all(k in data for k in required_keys):
            return {"valid": False, "error": "Missing required keys"}
        
        # Validate lint_issues structure
        if not isinstance(data["lint_issues"], list):
            return {"valid": False, "error": "lint_issues must be array"}
        
        for issue in data["lint_issues"]:
            required = {"type", "line", "code", "severity"}
            if not all(k in issue for k in required):
                return {"valid": False, "error": "Issue missing required fields"}
            
            valid_types = {"console_log", "unused_import", "todo_comment", "debugger", "hardcoded_secret"}
            if issue["type"] not in valid_types:
                return {"valid": False, "error": f"Invalid type: {issue['type']}"}
            
            valid_severity = {"error", "warning"}
            if issue["severity"] not in valid_severity:
                return {"valid": False, "error": f"Invalid severity: {issue['severity']}"}
        
        return {"valid": True, "data": data}
    
    except json.JSONDecodeError as e:
        return {"valid": False, "error": f"Invalid JSON: {str(e)}"}
    except Exception as e:
        return {"valid": False, "error": f"Unexpected error: {str(e)}"}


def run_lint_check(code: str, model: str = "mistral:latest") -> dict:
    """
    Run Ollama lint check with fallback logic.
    
    Returns: {"success": True/False, "issues": [...], "error": "..."}
    """
    import subprocess
    
    try:
        result = subprocess.run(
            ["bash", "ollama_lint_check.sh", code, model],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        response_text = result.stdout.strip()
        
        # Validate output
        validation = validate_lint_output(response_text)
        
        if not validation["valid"]:
            # Ollama output invalid → skip this check
            return {
                "success": False,
                "issues": [],
                "error": f"Ollama JSON invalid: {validation['error']}",
                "action": "SKIP_CHECK"
            }
        
        # Valid output, return issues
        data = validation["data"]
        return {
            "success": True,
            "issues": data["lint_issues"],
            "has_issues": data["has_issues"],
            "total_issues": data["total_issues"],
            "action": "REPORT_ISSUES" if data["has_issues"] else "NO_ISSUES"
        }
    
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "issues": [],
            "error": "Ollama timeout (>10s)",
            "action": "SKIP_CHECK"
        }
    
    except Exception as e:
        return {
            "success": False,
            "issues": [],
            "error": str(e),
            "action": "SKIP_CHECK"
        }
```

### Accuracy Target
- **Goal:** >95% accuracy on obvious issues
- **Fallback:** If JSON invalid or timeout → skip check (don't false-positive)
- **Human review:** Always the final gate before merge

---

## 📝 OLLAMA PROMPT 2: TEST SUMMARY EXTRACTION

### Purpose
Parse test output and extract: passed count, failed count, skipped count, timing.

### Model Selection
**Recommended:** `llama3.2:3b` (fast, simple extraction)  
**Alternative:** `mistral:latest` (if extraction unreliable)

### Prompt

```
You are a test result parser. Extract test metrics from the provided output.

Report in this exact JSON format (no extra text):
{
  "passed": <number>,
  "failed": <number>,
  "skipped": <number>,
  "duration_seconds": <number or null>,
  "success": <true|false>
}

RULES:
- "success" is TRUE if failed == 0
- If you cannot find a count, use 0
- Extract actual numbers only (no estimates)
- If no duration found, use null

TEST OUTPUT:
[OUTPUT_HERE]

Respond ONLY with valid JSON, no other text.
```

### Implementation (Python)

```python
def parse_test_output(test_output: str, model: str = "llama3.2:3b") -> dict:
    """
    Parse test output and extract summary metrics.
    
    Returns: {"valid": True, "summary": {...}} or {"valid": False, "error": "..."}
    """
    import subprocess
    import json
    
    prompt = f"""You are a test result parser. Extract test metrics from the provided output.

Report in this exact JSON format (no extra text):
{{
  "passed": <number>,
  "failed": <number>,
  "skipped": <number>,
  "duration_seconds": <number or null>,
  "success": <true|false>
}}

RULES:
- "success" is TRUE if failed == 0
- If you cannot find a count, use 0
- Extract actual numbers only (no estimates)
- If no duration found, use null

TEST OUTPUT:
{test_output}

Respond ONLY with valid JSON, no other text."""
    
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:11434/api/generate",
             "-d", json.dumps({
                 "model": model,
                 "prompt": prompt,
                 "stream": False,
                 "temperature": 0.1
             })],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        response_data = json.loads(result.stdout)
        response_text = response_data.get("response", "").strip()
        
        # Validate JSON
        try:
            summary = json.loads(response_text)
            
            # Validate required fields
            required = {"passed", "failed", "skipped", "duration_seconds", "success"}
            if not all(k in summary for k in required):
                return {"valid": False, "error": "Missing required fields"}
            
            # Validate types
            if not isinstance(summary["passed"], int) or summary["passed"] < 0:
                return {"valid": False, "error": "Invalid passed count"}
            if not isinstance(summary["failed"], int) or summary["failed"] < 0:
                return {"valid": False, "error": "Invalid failed count"}
            if not isinstance(summary["skipped"], int) or summary["skipped"] < 0:
                return {"valid": False, "error": "Invalid skipped count"}
            
            return {"valid": True, "summary": summary}
        
        except json.JSONDecodeError:
            return {"valid": False, "error": "Ollama response not valid JSON"}
    
    except subprocess.TimeoutExpired:
        return {"valid": False, "error": "Ollama timeout"}
    except Exception as e:
        return {"valid": False, "error": str(e)}
```

### Accuracy Target
- **Goal:** 100% (extract numbers, not interpret)
- **Fallback:** If JSON invalid → skip, don't use extracted summary
- **Human review:** Tests are always visible in PR anyway

---

## 🔄 Integration: How Codex Uses These

### **Flow for Each Task:**

```
Task Implementation:
├─ Codex writes code
├─ Before commit:
│  ├─ Run lint check (Ollama)
│  │  ├─ If valid JSON + issues found: Report them
│  │  ├─ If valid JSON + no issues: "OK to commit"
│  │  └─ If JSON invalid: "Skipping lint check"
│  └─ Fix any lint issues if flagged
│
├─ Run tests
├─ After tests:
│  ├─ Run test summary extraction (Ollama)
│  │  ├─ If valid: Include in PR description
│  │  └─ If invalid: Use raw test output instead
│
└─ Create PR with:
   ├─ Lint status (if available)
   ├─ Test summary (if parsed successfully)
   └─ Raw test output (always, fallback)
```

### **Example PR Description (With Ollama Data):**

```markdown
## TASK-003: Guest CRUD API

### Changes
- Created `app/api/guests.py` with 5 CRUD endpoints
- Added Pydantic validation schemas
- Created tests in `tests/test_guests.py`

### Pre-commit Validation
✅ Lint: 0 issues found

### Test Results
✅ 12 passed, 0 failed, 0 skipped (1.2s)

### Status
Ready for review
```

### **Example PR Description (Ollama Failed):**

```markdown
## TASK-003: Guest CRUD API

### Changes
- Created `app/api/guests.py` with 5 CRUD endpoints
- Added Pydantic validation schemas
- Created tests in `tests/test_guests.py`

### Test Results
[Raw output from pytest - Ollama extraction failed]
...12 passed in 1.2s...

### Status
Ready for review
```

---

## ⚙️ Installation Steps for Codex

### **Step 1: Save Ollama Lint Script**

Create `scripts/ollama_lint_check.sh`:

```bash
#!/bin/bash
CODE="$1"
MODEL="${2:-mistral:latest}"

# ... (see full script above)
```

### **Step 2: Add Python Functions to Codex Context**

In handover guide, include:

```python
# Available to Codex for use:
- run_lint_check(code: str, model: str) → dict
- parse_test_output(test_output: str, model: str) → dict

Usage:
  lint_result = run_lint_check(code_content)
  if lint_result["success"] and lint_result["has_issues"]:
      # Fix issues and re-commit
```

### **Step 3: Document in WEEK_N_HANDOVER_GUIDE.md**

Add section:

```markdown
## Ollama Feedback Loop (Tier 1)

Before committing:
1. Lint check: `python scripts/ollama_lint.py <file>`
   - Reports console.logs, unused imports, TODOs
   - If JSON invalid: check is skipped (safe)
   - If issues found: fix and re-commit

After tests:
2. Test summary: Extracted automatically
   - Added to PR description
   - If extraction fails: raw output shown instead

Both are optional feedback; human review is final gate.
```

---

## 📊 What Gets Tracked (Phase 0)

During Week 2-3, measure:

```
Per Codex task:
├─ Lint check runs: Y/N
├─ Issues found: count
├─ Ollama JSON valid: Y/N
├─ False positives: count (Codex had to fix non-issues)
├─ False negatives: count (human caught issues Ollama missed)
├─ Execution time: seconds
└─ Accuracy: (total_correct / total_checks)

Aggregate (weekly):
├─ Total lint checks: N
├─ Success rate: %
├─ False positive rate: %
├─ False negative rate: %
├─ Average execution time: ms
└─ Credit savings: (Codex API calls prevented)
```

---

## 🛡️ Fallback Logic Summary

```
Ollama Lint Check:
├─ If timeout (>10s): Skip, don't block
├─ If JSON invalid: Skip, don't block
├─ If JSON valid + issues: Report to Codex
├─ If JSON valid + no issues: Codex can commit
└─ Worst case: Check is skipped, Codex proceeds

Ollama Test Summary:
├─ If timeout (>10s): Use raw output instead
├─ If JSON invalid: Use raw output instead
├─ If JSON valid: Use extracted summary
└─ Worst case: Raw output shown in PR, summary not extracted

Human Review:
└─ Always final gate; Ollama output is advisory only
```

---

## ⚡ Expected Impact

### **Credit Savings (Estimated)**

```
Current: ~211 credits per task (Codex validates everything via Claude)

With Ollama Tier 1:
- Lint check: 0 credits (Ollama local)
- Test summary: 0 credits (Ollama local)
- Reduces Codex clarification questions by ~30%
- Estimated savings: 60-80 credits per task

New estimate: ~130-150 credits per task
Savings: ~30-40% per task
Weekly impact (15 tasks): 1,200-1,500 credits saved
```

### **Execution Time Impact**

```
Current: Codex asks Claude "is this formatted ok?" → ~5 minute delay per task

With Ollama Tier 1:
- Ollama lint check: <1 second response
- Codex gets instant feedback
- Can fix and re-commit immediately

Benefit: 4-5 minute speedup per task × 15 tasks/week = 60-75 min saved
```

---

## ✅ Readiness Checklist

Before Codex uses Ollama:

```
☐ Verify Ollama running: curl http://localhost:11434/api/tags
☐ Test lint check prompt: curl with sample code
☐ Test summary extraction: curl with sample pytest output
☐ Validate fallback logic: intentionally break JSON to test skip
☐ Document in handover: include Ollama section
☐ Measure baseline: Week 2 execution metrics
☐ Clear success criteria: >95% accuracy on lint, 100% on summary
```

---

## 🚀 Deployment Timeline

**This Week (Now):**
- ✅ Verify Ollama setup ← You're here
- ⏳ Test prompts on sample data (30 min)
- ⏳ Document in handover (15 min)
- ⏳ Ready for Codex Week 2 restart

**Week 2:**
- ⏳ Codex uses Ollama lint checks
- ⏳ Codex uses Ollama test summary
- ⏳ Track accuracy metrics

**Week 3:**
- ⏳ Review Phase 0 data
- ⏳ Decide on Tier 2 expansion

---

**Next Step:** Test the prompts on sample code/output, then you're ready to point Codex at this guide.

Ready to test?
