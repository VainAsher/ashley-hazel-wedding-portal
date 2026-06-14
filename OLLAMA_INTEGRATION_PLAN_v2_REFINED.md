# Ollama Integration for Codex — Refined Cost Optimization Plan

**Version:** 2.0 (Improved based on actual Week 1-2 execution data)  
**Date:** 2026-06-10  
**Status:** Ready for Validation Phase  

---

## 🎯 Why This Refinement?

The original plan was solid but made assumptions not grounded in actual data. This version incorporates learnings from:
- Week 1 execution (10 tasks, 9 hours, zero rework)
- Week 2 execution (2 PRs in <24 hours, comprehensive validation)
- Actual token cost patterns from review loop execution

---

## 📊 Critical Baseline First: Measure Before Optimizing

### Phase 0: Measurement & Validation (Do This First)

**Before integrating Ollama, establish baseline:**

```
WEEK 2 FRIDAY REVIEW LOOP (Current):
├─ Phase 1 Review: 5 agents (parallel)
│  ├─ Frontend review:          ~12K tokens
│  ├─ Backend review:           ~14K tokens
│  ├─ Database review:          ~10K tokens
│  ├─ Testing review:           ~11K tokens
│  └─ Git/organization review:  ~9K tokens
│  Total Phase 1: ~56K tokens
│
├─ Phase 2 Synthesis: 3 agents (parallel)
│  ├─ Task breakdown:           ~18K tokens
│  ├─ Production readiness:     ~15K tokens
│  └─ Handover package:         ~16K tokens
│  Total Phase 2: ~49K tokens
│
└─ TOTAL WEEKLY: ~105K tokens
```

**Action:** Track actual token usage for 2-3 weeks before making changes.

**Why:** The original plan assumed extraction is 15K tokens, but if actual extraction is 3K tokens, the savings opportunity is much smaller (3-5% not 25-35%).

---

## 🎯 Real-World Constraints (From Your Setup)

### 1. **You Have Ollama on Local Workstation**
- **Available:** 7B model running locally
- **Latency:** ~50-200ms per inference (depends on input size)
- **Memory:** Typical 7B model = ~4GB RAM
- **Throughput:** Single requests fine; batch processing slow

### 2. **Codex Is Already Very Efficient**
- Week 1: 10 tasks, 9 hours, **zero rework**
- Week 2 (in progress): 2 PRs in <24 hours, **comprehensive validation**
- Velocity: ~1.5 tasks/hour or ~10-15 minutes per task
- **Current bottleneck:** Not token costs, but async review cycle time

### 3. **Token Cost May Not Be The Blocker**
- Current estimate: ~105K tokens/week for review loop
- At Claude Haiku pricing (~$0.80/M input tokens): **~$0.08/week** for review
- Time investment: 2-3 hours/week for humans
- **Actual constraint:** Human review turnaround, not token budget

---

## 🔍 Better Target: Accuracy-First Integration

Instead of "reduce costs," aim for "maintain accuracy while delegating lower-stakes work."

### Tier 1: Low-Risk Tasks (Safe for Ollama)
**These are deterministic, rule-based, easy to validate:**

```
✅ Code formatting/linting checks (pattern matching)
✅ Test result summarization (extraction + aggregation)
✅ Git history parsing (text extraction)
✅ PR description template scaffolding (templating)
✅ Obvious lint issues (console.logs, unused imports, TODOs)
```

### Tier 2: Medium-Risk Tasks (Needs Hybrid)
**These need judgment, but Ollama can do 80% if scaffolded:**

```
⚠️  Configuration validation (schema-based, rule-driven)
⚠️  Task clarity scoring (against rubric, not creative assessment)
⚠️  Pattern matching (does code follow repo conventions?)
```

### Tier 3: High-Risk Tasks (Claude-only)
**These need real semantic understanding; Ollama will fail:**

```
❌ Security analysis (risk of missing subtle issues)
❌ Architecture decisions (requires big-picture reasoning)
❌ Production readiness assessment (nuanced judgment)
❌ Task prioritization (requires trade-off analysis)
```

---

## 📋 Refined Implementation Strategy

### Phase 1: Pilot Program (1-2 weeks, Low Risk)

**Start ONLY with Tier 1 tasks. No security/review delegation yet.**

```
CODEX WEEKLY EXECUTION SUPPORT (Ollama):

Before Each Commit:
├─ Run Ollama: Code lint check
│  Input: git diff output
│  Output: JSON [console.logs, unused imports, TODO comments, formatting]
│  Accuracy Target: >98% (false positives are bad)
│  Claude Fallback: If Ollama output invalid JSON, skip
│
After Each Test Run:
├─ Run Ollama: Test result summary
│  Input: pytest/npm test output
│  Output: JSON {passed: N, failed: N, summary: text}
│  Accuracy Target: 100% (must match ground truth)
│  Claude Fallback: Always validate against raw output
│
PR Creation:
└─ Run Ollama: PR description template
   Input: task name + feature description
   Output: PR template with sections filled in
   Accuracy Target: >90% (human will refine anyway)
   Claude Fallback: Use template as-is if reasonable
```

**Why Tier 1 first:**
- Easy to validate (ground truth is clear)
- Low consequence if wrong (human sees PR before merge)
- Gives you confidence before moving to Tier 2
- Can be disabled without breaking anything

### Phase 2: Expand to Tier 2 (After 2 weeks of success)

Only after Phase 1 runs clean for 2 weeks:

```
TASK VALIDATION SCAFFOLDING (Ollama):

After Phase 2 synthesis generates task list:
├─ Run Ollama: Task clarity validator
│  Input: Task description, acceptance criteria
│  Output: JSON {status: valid|needs_revision, issues: [list], score: 1-10}
│  Accuracy Target: >85% (should catch obvious problems)
│  Human Review: Always review Ollama output before sending to Codex
│
CONFIGURATION VALIDATION (Ollama):

Before merging env-related PRs:
├─ Run Ollama: Config validator
│  Input: Code changes + schema
│  Output: JSON {missing: [fields], extra: [fields], valid_structure: bool}
│  Accuracy Target: >95% (structural validation is deterministic)
│  Claude Backup: If any doubt, Claude reviews
```

### Phase 3: Never Migrate To Tier 3

**Keep security, architecture, and production readiness decisions with Claude.** These are where human judgment matters most and false negatives are expensive.

---

## 🧪 Realistic Token Savings (Conservative Estimate)

Based on Week 1-2 actual data:

| Task | Current Cost | With Ollama Tier 1 | Savings | Risk |
|------|-------------|-------------------|---------|------|
| Review loop (weekly) | ~105K tokens | ~100K tokens | ~5% | Low (Tier 1 only) |
| Codex execution support | ~20K tokens | ~15K tokens | ~25% | Low (Tier 1 only) |
| Task validation (Tier 2) | ~12K tokens | ~8K tokens | ~33% | Medium |
| **Total Realistic** | ~137K/week | ~120K/week | **~12% savings** | |

**Real savings: ~$0.01-0.02/week at Claude Haiku pricing**

**Non-monetary benefits:**
- ✅ Faster feedback to Codex (Ollama responds <200ms)
- ✅ Removes tedious work (linting, summarization)
- ✅ Codex sees validation feedback immediately
- ✅ Humans can focus on judgment calls

---

## 🛠️ Implementation Plan (Revised)

### Step 1: Setup & Validation (Week of June 10)

```
❑ Create ollama_schemas.json with Tier 1 task schemas
❑ Create ollama_prompts.md with Tier 1 prompts
❑ Test Ollama on 10 sample lint checks:
  - Check JSON validity: 100%
  - Compare against actual linting: >98% match
  - Test latency: should be <200ms
❑ Test Ollama on 5 sample test summaries:
  - Check JSON validity: 100%
  - Compare against ground truth: 100% match
❑ Document in CODEX_REVIEW_LOOP_PROCESS_v2.md
```

### Step 2: Pilot Codex Execution (Week 3)

When Codex starts Week 3 tasks:
```
❑ Run Ollama lint check before Codex commits
  - Ollama flags any obvious issues
  - Codex can fix before creating PR
  - Track: How many issues caught?
  
❑ Run Ollama summary after test runs
  - Extract test results automatically
  - Add to PR description
  - Track: How accurate are summaries?
```

**Success metric:** Ollama catches 5+ issues/week, accuracy >98%

### Step 3: Review & Measure (End of Week 3)

```
❑ Compare token usage: baseline vs with Ollama
❑ Measure Ollama latency in practice
❑ Codex feedback: Was Ollama helpful? Did it slow things down?
❑ Decision: Continue to Phase 2 or adjust?
```

---

## ⚠️ Critical Risk Mitigation

### Risk 1: Ollama Produces Invalid JSON
**Mitigation:** Always validate JSON schema before using output
```python
try:
    result = json.loads(ollama_output)
    # Validate against schema
except (json.JSONDecodeError, ValidationError):
    # Fall back to Claude or skip
    log_error("Ollama output invalid, skipping")
```

### Risk 2: Ollama Misses Security Issues
**Mitigation:** NEVER use Ollama for security review
- Keep all security analysis with Claude
- Tier 3 tasks stay Claude-only
- Document this as non-negotiable

### Risk 3: False Positives Slow Codex Down
**Mitigation:** Only flag high-confidence issues
```
Lint check: Only flag errors, not warnings
Test summary: Only report test counts, let human read details
PR template: Only scaffold structure, human fills content
```

### Risk 4: Ollama Becomes A Bottleneck
**Mitigation:** Monitor latency in Week 3 pilot
- If Ollama >500ms/request: abandon or use async
- If impacts Codex velocity: disable immediately
- Better to stay with pure Claude than add latency

---

## 📈 Decision Framework

### Proceed to Phase 2 if:
```
✅ Phase 1 runs for 2+ weeks cleanly
✅ Token costs are actually >$0.20/week (currently ~$0.08/week)
✅ Ollama latency <200ms consistently
✅ Ollama accuracy >98% on Tier 1 tasks
✅ Codex reports no friction from Ollama integration
```

### Abandon Ollama if:
```
❌ Ollama latency >300ms or unreliable
❌ False positive rate >5%
❌ JSON validation fails >10% of time
❌ Token savings <5% (not worth complexity)
❌ Codex velocity decreases
```

### Partial Integration OK:
```
⚠️  Just use Ollama for test summarization (lowest risk)
⚠️  Skip lint checks if they slow things down
⚠️  Keep PR scaffolding simple
```

---

## 📋 What NOT to Do

```
❌ Don't use Ollama for security review
❌ Don't use Ollama for architecture decisions
❌ Don't add Ollama without baseline measurement
❌ Don't integrate all 3 tiers at once
❌ Don't optimize for cost if it adds latency/risk
❌ Don't assume 25-35% savings (unrealistic)
❌ Don't deploy without human-in-the-loop validation
```

---

## 🎯 Summary: Revised Approach

| Aspect | Original Plan | Revised Plan |
|--------|---------------|--------------|
| **Goal** | Reduce costs 25-35% | Maintain accuracy, reduce tedium 12% |
| **Token Savings** | ~35K tokens/week | ~15-20K tokens/week (realistic) |
| **Risk Level** | Medium (broad scope) | Low (Tier 1 only initially) |
| **Deployment** | All 3 tiers together | Phased (Tier 1 → Measure → Tier 2) |
| **Measurement** | Assumed 95% accuracy | Validate >98% accuracy before use |
| **Security Tasks** | Ollama for some | Claude-only (no Ollama) |
| **Timeline** | Implement immediately | Week 1 setup, Week 2 pilot, Week 3+ expand |
| **Success Metric** | Cost reduction | Codex velocity + accuracy maintained |

---

## 🚀 Action Items (Prioritized)

### Immediate (This Week)
1. **Measure baseline token costs** for actual Week 2 review loop
2. **Set up Ollama locally** and test with sample data
3. **Create schemas.json** for Tier 1 tasks only
4. **Document in CODEX_REVIEW_LOOP_PROCESS_v2.md**

### Before Week 3 (Next Week)
1. **Run Tier 1 tests** on 10+ samples
2. **Validate accuracy** >98% for lint, test summaries
3. **Measure latency** in realistic conditions
4. **Get Codex approval** before integrating

### Week 3+ (Conditional)
1. **Pilot Ollama** with WEEK_3 tasks
2. **Measure impact** on token costs and velocity
3. **Review feedback** from Codex execution
4. **Decide on Phase 2** expansion

---

## 💡 Key Insight

**Current bottleneck is NOT token cost but human review latency.**

Ollama could help here by:
- Providing fast feedback to Codex (lint checks in <200ms)
- Summarizing tests faster (human doesn't need to read full output)
- Reducing context-switching (Codex gets immediate feedback)

**This is worth doing** if:
- Ollama stays reliable and accurate
- It doesn't add latency
- It reduces tedious work (not decision-making)

**This is NOT worth doing** if:
- Token savings are <10% (complexity not justified)
- Ollama is unreliable (adds friction, not reduces)
- It makes Codex wait longer for feedback

---

## 📝 Next Steps

1. **Read this plan**
2. **Agree/disagree on approach** (Tier 1 first vs. full integration)
3. **Set measurement baseline** (track actual token costs)
4. **Run Phase 0** (validation tests)
5. **Decide on Week 3 pilot** based on data

---

**This refined approach trades perfect cost optimization for reduced risk, better data, and clearer decision points. Better to be wrong with data than wrong without it.**

**What do you think? Should we start with Phase 0 measurement?**
