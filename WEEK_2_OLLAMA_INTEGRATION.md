# Week 2: Ollama Tier 1 Integration Section

**For Codex Handover Package**

---

## 🚀 NEW: Ollama Feedback Loop (Tier 1 - Experimental)

**What This Is:**  
Instant local feedback on code quality and test results. No waiting for Claude API. Completely optional.

**Why Now:**  
To reduce API token costs while keeping code quality high. If Ollama feedback helps, we'll expand. If not, we skip it.

---

## ✅ What Ollama Does (Tier 1)

### **1. Lint Checks (Before Commit)**

Ollama detects obvious code issues:
- ✅ `console.log()`, `console.warn()`, `console.error()` statements
- ✅ Unused imports
- ✅ `// TODO` and `// FIXME` comments
- ✅ `debugger` statements
- ✅ Hardcoded passwords/secrets

**You don't have to use it**, but if it flags something, it's usually correct.

**Example:**
```
Ollama: Found console.log on line 45 in app/api/guests.py
You: Remove it, re-commit
```

### **2. Test Summary Extraction (After Tests)**

Ollama parses test output and adds to PR description:
- Passed count
- Failed count
- Skipped count
- Duration

**Example:**
```
PR Description:
✅ 12 passed, 0 failed, 1.23s
```

---

## 🔄 How to Use It

### **Workflow:**

```
1. Write code
2. Commit locally
3. Ollama lint check runs (you see: "0 issues found")
4. If issues: Fix them, re-commit
5. Run tests
6. Ollama extracts summary (added to PR)
7. Push to GitHub
8. Create PR
9. Human reviews (you can mention Ollama feedback)
```

**None of this blocks you.** If Ollama fails or times out, just proceed.

---

## ⚙️ Technical Details

### **Models Used:**
- Lint checks: `mistral:latest` (7.2B, fast + accurate)
- Test summary: `llama3.2:3b` (3B, very fast for simple extraction)

### **Accuracy Targets:**
- Lint checks: >95% (catches real issues, minimal false positives)
- Test summary: >99% (deterministic number extraction)

### **Fallback Behavior:**
```
If Ollama times out (>10s): Check is skipped
If Ollama JSON invalid: Check is skipped
If Ollama works: You get feedback

Worst case: Nothing bad happens, you just don't get feedback.
```

---

## 📝 Your Task: Nothing New

Ollama runs **in the background automatically** when you commit.

**You don't have to do anything** except:

1. **If Ollama flags lint issues:** Review and fix if valid
2. **If test summary looks wrong:** Check raw output (included in PR)
3. **Track accuracy** (see tracking template below)

---

## 📊 Phase 0: Measurement (Week 2-3)

We're testing whether Ollama actually helps reduce costs.

### **Simple Tracking (Per Task)**

Keep notes on a spreadsheet or checklist:

```
Task | Lint Check | Issues Found? | False Pos? | Test Summary | Parse OK? | Notes
-----|-----------|---------------|-----------|--------------|-----------|-------
001  | Ran       | No            | -         | Yes          | Yes       | Working well
002  | Ran       | Yes (console) | No        | Yes          | Yes       | Found real issue
003  | Timeout   | Skipped       | -         | Failed       | No        | Used raw output
```

**What to track:**
- Did lint check run?
- Did it find real issues?
- Did it have false positives? (flagged non-issues)
- Did test summary extract correctly?
- Any unusual behavior?

See: **OLLAMA_PHASE0_TRACKING.md** (created separately)

---

## 💰 Expected Impact

**Current costs (without Ollama):**
- 211 credits per task
- ~3,165 credits per week (15 tasks)

**With Ollama Tier 1:**
- ~130-150 credits per task (estimated)
- ~1,950-2,250 credits per week

**Estimated savings: ~30-40% per task**

*Actual results may vary. We'll measure during Week 2-3.*

---

## ❓ FAQ

**Q: What if Ollama makes a mistake?**  
A: Human review catches it. Ollama output is advisory only.

**Q: What if I don't want to use it?**  
A: You don't have to. Skip the feedback, just push to GitHub.

**Q: Does this replace human review?**  
A: No. Human review is always final. Ollama is just faster feedback.

**Q: What if Ollama is wrong about a security issue?**  
A: Ollama only checks for obvious things (console.logs, hardcoded strings). Security review is always human-only.

**Q: Can I disable it?**  
A: Yes. If it's causing problems, just skip it. We'll decide after Week 2.

---

## 🎯 Success Criteria for Tier 1

After Week 2-3, we'll decide to keep it if:

```
✅ Lint accuracy: >95% (real issues, few false positives)
✅ Test summary: >95% accurate
✅ Latency: <1 second per check
✅ Credit savings: >20% demonstrated
✅ Codex workflow: Not disrupted
```

If any of these fail, we disable Tier 1 and try again later.

---

## 📚 Technical Reference

Full implementation details: **OLLAMA_TIER1_IMPLEMENTATION.md**

For now, just know:
- Ollama runs locally (free)
- Runs on each commit/test
- Feedback appears before you push
- All optional, all fallbacks in place

---

**Ready to try it? It's completely safe and optional.**

If you have questions during Week 2, just note them and we'll review in Week 3 measurement phase.

---

**Next: See OLLAMA_PHASE0_TRACKING.md for measurement template**
