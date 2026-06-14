# Ollama Phase 0: Measurement & Tracking

**Purpose:** Measure actual Ollama performance during Week 2-3 execution  
**Duration:** 2 weeks  
**Output:** Data to decide on Tier 2 expansion  
**Effort:** ~2 minutes per task (just fill in the checklist)

---

## 📊 Weekly Tracking Template

### **Week 2 Ollama Performance Log**

Copy this template and fill it in as you complete each task:

```
WEEK 2 - OLLAMA TIER 1 MEASUREMENT LOG
Date: 2026-06-10 to 2026-06-14

Task | Lint Check | Lint Issues | False Pos? | FN Caught Later? | Test Summary | Parse OK? | Ollama Time | Notes
-----|-----------|-------------|-----------|-----------------|--------------|-----------|------------|------
001  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 
002  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 
003  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 
004  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 
005  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 
...
015  | Y/N       | Count       | Y/N       | Y/N             | Y/N          | Y/N       | [ms]       | 

TOTALS:
- Tasks with lint check: X/15
- Total issues found: X
- False positives: X
- False negatives caught by human: X
- Test summary extraction success: X/15
- Average Ollama time: XXms
```

---

## 📋 What Each Column Means

### **Lint Check (Y/N)**
- Did Ollama lint check run for this task?
- Y = Ran successfully
- N = Skipped (timeout, JSON invalid, or error)

### **Lint Issues (Count)**
- How many issues did Ollama find?
- Include: console.logs, unused imports, TODOs, debuggers, secrets
- Example: "2" means found 2 issues

### **False Positives (Y/N)**
- Did Ollama flag something that **wasn't actually an issue**?
- Y = Yes, Ollama flagged non-issue (Codex had to fix non-problem)
- N = No, all flags were real issues
- Example: "Y" = Ollama said "unused import" but it was actually used

### **False Negatives Caught Later (Y/N)**
- Did **human review catch issues that Ollama missed**?
- Y = Yes, human found problem Ollama didn't flag
- N = No, Ollama caught everything
- Example: "Y" = Ollama missed console.log on line 45

### **Test Summary (Y/N)**
- Did Ollama extract test results?
- Y = Yes, parsed correctly
- N = No, parsing failed (used raw output instead)

### **Parse OK (Y/N)**
- Was Ollama's JSON output valid?
- Y = Valid JSON, usable
- N = Invalid JSON, had to skip

### **Ollama Time (ms)**
- How long did Ollama take to respond?
- Record in milliseconds (aim for <1000ms)
- Example: "125ms" = fast, "5000ms" = slow, "timeout" = failed

### **Notes**
- Any issues or observations
- Examples: "Caught real security issue", "Timed out twice", "Different numbers than pytest"

---

## 🎯 Daily Summary Template

At the end of each day, aggregate:

```
=== DAILY SUMMARY ===
Date: 2026-06-10
Tasks completed: 4
Tasks with lint check: 4/4 (100%)
Issues found: 6 total
False positives: 0
False negatives: 1 (human caught hardcoded password)
Test summary success rate: 4/4 (100%)
Average Ollama latency: 156ms
Status: All working well

Notable issues:
- TASK-002: Found hardcoded API key (good catch!)
- TASK-003: Test summary undercounted by 1 (used raw output instead)
```

---

## 📈 Weekly Summary Template

At end of Week 2, compile:

```
=== WEEK 2 SUMMARY: OLLAMA TIER 1 ===

LINT CHECK PERFORMANCE:
- Tasks run: 15/15 (100%)
- Total issues found: 23
- False positive rate: 0% (0/23 were non-issues)
- False negative rate: 13% (3 issues human caught later)
- Accuracy: 87% (19/22 real issues caught)

TEST SUMMARY PERFORMANCE:
- Tasks run: 15/15 (100%)
- Parse success rate: 93% (14/15)
- Failures: 1 (used raw output)
- Accuracy when parsed: 100% (14/14 were correct)

LATENCY:
- Average per check: 234ms
- Min: 98ms
- Max: 4200ms (1 timeout)
- 95th percentile: 512ms

CREDIT IMPACT:
- Baseline: 211 credits/task
- Estimated with Ollama: 165 credits/task
- Actual measurement needed: (track API calls in handover)
- Savings: ~22% (achieved)

DECISION:
[ ] Keep Tier 1, deploy Tier 2
[ ] Keep Tier 1, don't deploy Tier 2 (good enough)
[ ] Disable Tier 1 (not working)
[ ] Adjust and retry
```

---

## 🔍 Detailed Issue Tracking (Optional But Helpful)

If you want more detail, also track:

```
ISSUE LOG:
Task | Type | Line | Code | Severity | Caught By | Result
-----|------|------|------|----------|-----------|--------
001  | TODO | 45   | // TODO: validate | warning | Ollama | Fixed
002  | Secret | 23 | password="..." | error | Ollama | Fixed
003  | ConsoleLog | 12 | console.log(...) | warning | Human | Fixed
...
```

---

## 💡 What We're Actually Testing

**Question 1: Accuracy**
- Does Ollama find real issues? (Should be >95%)
- Does Ollama have false positives? (Should be <5%)
- Does Ollama miss things? (Should be <10%)

**Question 2: Cost Impact**
- How many Codex API calls does Ollama prevent?
- Estimated: 30-40% fewer clarification questions to Claude
- Measured: Compare Week 2 credit usage to baseline

**Question 3: Time Impact**
- Does Ollama provide feedback fast enough? (<1 second ideal)
- Does it disrupt Codex workflow?
- Does async feedback actually save time?

**Question 4: Usability**
- Does Codex understand Ollama feedback?
- Does Codex act on it (fix issues)?
- Any confusion or errors?

---

## 📱 Simple Daily Checklist (Minimal Version)

If detailed tracking is too much, use this minimal version:

```
WEEK 2 - SIMPLIFIED TRACKING

Daily: Per task you complete:
  ☐ Lint check ran? Y/N
  ☐ Found issues? Y/N
  ☐ Any false positives? Y/N
  ☐ Test summary OK? Y/N
  
Friday: Quick summary
  - How many tasks used Ollama successfully? 
  - Any major issues?
  - Keep Tier 1 for Week 3? Y/N
  - Notes?
```

---

## 📊 Key Metrics to Calculate

At end of Phase 0, calculate:

### **Accuracy Metrics**

```
Lint Check Accuracy = (Issues found correctly) / (Total issues reported) × 100
  Target: >95%

Lint False Positive Rate = (False positives) / (Total issues reported) × 100
  Target: <5%

Lint False Negative Rate = (Issues caught by human) / (Total real issues) × 100
  Target: <10%

Test Summary Accuracy = (Correct extractions) / (Attempted extractions) × 100
  Target: >95%
```

### **Performance Metrics**

```
Lint Check Latency (P50) = Median response time
  Target: <300ms

Lint Check Latency (P95) = 95th percentile response time
  Target: <1000ms

Test Summary Latency (P50) = Median response time
  Target: <200ms
```

### **Cost Metrics**

```
Baseline Cost = 211 credits/task (measured Week 1)

Cost with Ollama = [New measurement from Week 2]

Savings % = (Baseline - New Cost) / Baseline × 100
  Target: >20%

Credit Savings/Week = Tasks/Week × Savings/Task × Credits/Task
  Example: 15 tasks × 30% × 211 credits = 949 credits saved/week
```

---

## 🎯 Decision Criteria (Friday, End of Week 2)

**Keep Tier 1 if:**
- ✅ Lint accuracy >90%
- ✅ Test summary accuracy >90%
- ✅ Latency <1 second
- ✅ No major disruptions to Codex workflow

**Expand to Tier 2 if:**
- ✅ All "Keep Tier 1" criteria met
- ✅ Credit savings >20% demonstrated
- ✅ False negative rate <15%

**Disable if:**
- ❌ Accuracy <80%
- ❌ Latency >5 seconds consistently
- ❌ Disrupts Codex workflow
- ❌ Too many false positives

---

## 📝 How to Actually Fill This In

### **During the week (per task):**

```
Spend 2 minutes after each task:

1. Open OLLAMA_PHASE0_TRACKING.md
2. Find today's date
3. Fill in one row:
   - Task number: 001, 002, etc.
   - Lint Check: Y or N
   - Issues: How many? (0, 1, 2, etc.)
   - False positive: Y or N (Ollama flagged non-issue?)
   - FN later: Y or N (Human found something Ollama missed?)
   - Test summary: Y or N
   - Parse OK: Y or N
   - Time: ~100-500ms typical
   - Notes: Anything unusual

4. Done. Takes 2 minutes.
```

### **Friday (end of week):**

```
Spend 10 minutes aggregating:

1. Count totals:
   - How many lint checks ran?
   - How many had issues?
   - How many false positives?
   - How many test summaries worked?

2. Calculate percentages:
   - Success rate: X/15 = Y%
   - Accuracy: (issues found correctly) / (total issues)

3. Write brief summary:
   - Overall: Working well / Needs improvement / Disable
   - Recommendation: Keep / Expand / Disable
   - Notes for Week 3

4. Done. Takes 10 minutes.
```

---

## 💾 Where to Save It

Options:

1. **Markdown file in repo:** `OLLAMA_WEEK2_MEASUREMENT_LOG.md` (version control)
2. **Simple text file:** `ollama_tracking.txt` (quick edits)
3. **Spreadsheet:** Excel/Google Sheets (easier calculations)
4. **Notion/OneNote:** If you use those

**Recommendation:** Markdown file in repo (version-controlled, easy to compare weeks)

---

## 🔄 After Phase 0 (Week 3)

**Friday of Week 3:**

1. Compile final measurements
2. Calculate metrics
3. Make decision: Keep/Expand/Disable
4. Document in: `OLLAMA_PHASE0_RESULTS.md`
5. Plan Phase 2 accordingly

---

## ✅ Ready?

Print/copy this template and fill in one row per task during Week 2.

That's it. No complicated logging, just simple tracking to answer:
- **Does Ollama work well?** (accuracy + latency)
- **Does it save credits?** (measure week 2 vs week 1)
- **Should we keep it?** (yes/no decision)

**Simple, practical, data-driven.**

Let me know if you want to adjust the template before Week 2 starts.

---

## Actual Week 2 Log

| Task | Lint Check | Lint Issues | False Pos? | FN Caught Later? | Test Summary | Parse OK? | Ollama Time | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 007 | N | 0 | N | N | N | N/A | N/A | Ollama lint skipped because no lint helper exists in `origin/main`; raw local, VM, branch CI, and PR CI summaries were used. |
| 008 | N | 0 | N | N | N | N/A | N/A | Ollama lint skipped because no lint helper exists in `origin/main`; raw workflow checks, VM dry run, VM backend tests, branch CI, and PR CI summaries were used. |
| 009 | N | 0 | N | N | N | N/A | timeout | Ollama helper invoked on `app/config.py` and `scripts/validate_config.py` but timed out/unavailable; raw local, VM, branch CI, and PR CI summaries were used. |
| 010 | Y | 1 | N | N | N | Y | 4-6s | Ollama lint ran on changed Python test files, caught a real fallback `DATABASE_URL` credential placeholder in `conftest.py`, and rerun reported 0 issues. |
| 011 | Y | 0 | N | N | N | Y | 6.8s | Ollama lint ran on `test_guests_integration.py` and reported 0 issues; raw local, VM, branch CI, and PR CI summaries were used. |
| 012 | Y | 2 | Y | N | N | Y | 5.4s | Ollama lint ran on `guest-management.spec.ts` and reported 2 false positives: Playwright browser-error collection as `console_log` and a non-existent TODO line. |
| 013 | Y | 2 | Y | Y | N | Y | 8-10s + 4s | Initial lint found one useful test sentinel and one false unused-import finding; follow-up lint found 0 issues. Runtime VM smoke caught Uvicorn access-log args regression missed by lint/CI; fixed in PR #38. |
| 014 | Y | 1 | Y | N | N | Y | 8-11s | Ollama lint ran on error tracking, tests, main, and config. It reported one false positive by classifying a normal Python logger.info call as console_log; no real issues found. |
