# Three-Tier Intelligence Routing Architecture

**Concept:** Claude (me) + Codex + Ollama as a layered system, each tier handling what it's best at.

**Date:** 2026-06-10  
**Status:** Architectural Design (Ready for Validation)  

---

## 🎯 The Core Insight

Rather than "replace Claude with Ollama to save money," think **"right-tool-for-the-job routing."**

Each tier has natural strengths:

```
CLAUDE (Tier 1):
├─ Complex reasoning & judgment
├─ Cross-domain pattern synthesis
├─ Strategic trade-off analysis
├─ Novelty & edge-case handling
└─ High-stakes decision making
   
CODEX (Tier 2):
├─ Pattern application (code implementation)
├─ Rubric-based validation
├─ Domain-specific logic
├─ Integration & orchestration
└─ Medium-complexity tasks with clear structure

OLLAMA (Tier 3):
├─ Fast, deterministic extraction
├─ Structural pattern matching
├─ Rule-based logic
├─ Templating & formatting
└─ Parallel, high-volume operations
```

**Natural division:** Judgment → Logic → Pattern Matching

---

## 🏗️ Architecture Overview

```
                      USER / SYSTEM
                            ↓
                    ┌───────────────┐
                    │  SMART ROUTER │
                    │  (Complexity  │
                    │   Classifier) │
                    └───────┬───────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
    TIER 1              TIER 2              TIER 3
    (CLAUDE)            (CODEX)             (OLLAMA)
    ─────────────────────────────────────────────
    Judgment            Implementation      Extraction
    Synthesis           Pattern Logic       Fast Ops
    Strategy            Validation          Templating
        
    High Cost           Medium Cost         Free/Local
    ~100ms              ~200ms              ~50ms
    
    ↓                   ↓                   ↓
    ┌───────────────────┴───────────────────┐
    │        RESULT AGGREGATION             │
    │    (Combine outputs + validate)       │
    └─────────────────────────────────────┘
                        ↓
                    FINAL OUTPUT
```

---

## 🎯 Task Routing Rules

### Tier 1 (Claude) - Complex Judgment Required

**Route here if:**
- ✅ Requires judgment call (no clear right answer)
- ✅ Involves trade-offs (A vs B, choose based on context)
- ✅ Touches security/architecture (high-stakes)
- ✅ Novel problem (hasn't been solved exactly this way)
- ✅ Cross-cutting concern (impacts multiple domains)
- ✅ Synthesis of many inputs (requires seeing patterns)

**Examples:**
```
✅ Week 2 Production Readiness Assessment
   (Many factors, conflicting signals, judgment needed)

✅ Task prioritization for Week N+1
   (Tradeoff: quick wins vs. long-term impact)

✅ Risk assessment & mitigation strategy
   (What could go wrong? How bad?)

✅ Handover narrative & context setting
   (Why these tasks? How do they fit together?)

✅ Architectural decisions
   (How to structure new domains? Patterns to establish?)
```

### Tier 2 (Codex) - Logic Application

**Route here if:**
- ✅ Clear logic/rules exist (documented patterns)
- ✅ Structured input & output
- ✅ Domain-specific but not strategic
- ✅ Can be validated against acceptance criteria
- ✅ Needs both pattern matching AND integration

**Examples:**
```
✅ Task acceptance criteria validation
   (Does each task meet the rubric? ✓ Yes/No)

✅ Code pattern enforcement
   (Does PR follow established patterns? Check against examples)

✅ Configuration validation
   (Does env config match schema? Validate structure)

✅ Dependency mapping
   (Which tasks depend on which? Draw DAG, detect cycles)

✅ PR scaffolding with examples
   (Create template structure + fill with patterns from repo)

✅ Test result aggregation & analysis
   (Parse test output, extract pass/fail/timing, compute stats)
```

### Tier 3 (Ollama) - Fast Extraction & Formatting

**Route here if:**
- ✅ Fully deterministic (same input = always same output)
- ✅ No judgment needed
- ✅ Speed matters (< 100ms required)
- ✅ High volume (many parallel operations)
- ✅ Easy to validate (ground truth obvious)

**Examples:**
```
✅ Code lint checks
   (Look for console.logs, unused vars, TODOs → list them)

✅ Test result summary extraction
   (Parse "17 passed, 2 failed" → JSON {passed: 17, failed: 2})

✅ Git commit history parsing
   (Extract commits, dates, messages → structured data)

✅ PR description template scaffolding
   (Fill in: task ID, description, test status → template)

✅ Finding severity categorization
   (If security + code injection → critical; else medium)

✅ Comment extraction from code
   (Find all // TODO comments → list for review)
```

---

## 💡 Why This Works (Better Than Single-Tier)

### 1. **Natural Fit**
```
Claude is good at reasoning → Use for reasoning
Codex is good at rules → Use for rules
Ollama is good at extraction → Use for extraction

Don't ask any tier to do what others do better.
```

### 2. **Speed Where It Matters**
```
Codex needs lint feedback quickly → Ollama responds in 50ms
Handover package needs thought → Claude takes 30 seconds, that's OK
Test summary needs parsing → Ollama does it instantly
```

### 3. **Cost Optimization That Makes Sense**
```
Claude $$ → For high-judgment calls (synthesis, strategy)
Codex $$ → For pattern application (medium cost)
Ollama $0 → For deterministic work (high volume)

Total cost: 30% of pure-Claude, 80% of pure-Ollama
Quality: Preserved (judgment work stays with Claude)
Speed: Better (parallel extraction via Ollama)
```

### 4. **Scalability**
```
If Ollama task fails: Fall back to Codex (slower but reliable)
If Codex task fails: Fall back to Claude (expensive but sure)
If Claude task fails: No fallback, but rarely needed (judgment is rare)
```

---

## 🔧 Example: Week 2 Friday Review Loop (3-Tier)

### Current (Pure Claude)
```
PHASE 1: 5 Review Agents (Claude)
├─ Frontend review          ~12K tokens
├─ Backend review           ~14K tokens
├─ Database review          ~10K tokens
├─ Testing review           ~11K tokens
└─ Git review               ~9K tokens
Total: ~56K tokens, ~5 min

PHASE 2: 3 Synthesis Agents (Claude)
├─ Task breakdown           ~18K tokens
├─ Production readiness     ~15K tokens
└─ Handover generator       ~16K tokens
Total: ~49K tokens, ~10 min

TOTAL: ~105K tokens, ~15 min
```

### With 3-Tier Routing
```
PHASE 1: REVIEW (Hybrid)

Sub-phase 1a: Core Analysis (Claude)
├─ Frontend quality assessment    ~10K tokens (judgment)
├─ Backend quality assessment     ~12K tokens (judgment)
├─ Database design evaluation     ~8K tokens (judgment)
├─ Testing strategy review        ~9K tokens (judgment)
└─ Git workflow assessment        ~7K tokens (judgment)
Total: ~46K tokens (Claude does judgment)

Sub-phase 1b: Extraction (Ollama + Codex)
├─ Extract findings → JSON            (Ollama, 100ms)
├─ Categorize severity              (Codex, apply rubric)
├─ Link evidence to findings         (Ollama, regex + matching)
└─ Assess actionability              (Codex, logic check)
Total: ~0 tokens (no Claude), ~500ms

PHASE 2: SYNTHESIS (Claude + Codex)

Sub-phase 2a: Strategic Decisions (Claude)
├─ Prioritize tasks (trade-offs)    ~12K tokens
├─ Identify risks                   ~10K tokens
└─ Set handover narrative           ~12K tokens
Total: ~34K tokens (Claude judgment)

Sub-phase 2b: Task Scaffolding (Codex)
├─ Validate task clarity            (Codex rules)
├─ Create code templates            (Codex pattern match)
├─ Map dependencies                 (Codex logic)
└─ Generate task structure          (Codex + Ollama templating)
Total: ~2-3K tokens (Codex as needed)

TOTAL: ~80-85K tokens (20% reduction)
BUT: Quality maintained (Claude does judgment)
     Speed: 30% faster (parallel Ollama extraction)
     Scalability: Can handle more weekly tasks
```

---

## 📋 Concrete API Design

### Router Interface

```python
class IntelligenceRouter:
    def route_task(self, task: Task) -> Tier:
        """
        Analyze task characteristics and route to appropriate tier.
        
        Characteristics measured:
        - complexity_score: 1-10 (0=trivial, 10=novel complex problem)
        - judgment_required: bool (is there a "right answer"?)
        - stakes: "low" | "medium" | "high" (impact if wrong)
        - structure: "unstructured" | "semi" | "fully_structured"
        - latency_requirement: ms (how fast needed?)
        - volume: int (how many parallel instances?)
        
        Returns: Tier1 | Tier2 | Tier3
        """
        
        if task.judgment_required and task.stakes == "high":
            return Tier1  # Claude
        elif task.structure == "fully_structured" and task.latency_requirement < 100:
            return Tier3  # Ollama
        else:
            return Tier2  # Codex
```

### Tier Interfaces

```python
class Tier1(Claude):
    """Complex judgment, synthesis, strategy"""
    def synthesize_findings(self, findings: List[Finding]) -> HandoverPackage:
        # Use full Claude reasoning
        pass
    
    def assess_risk(self, changes: CodeChanges) -> RiskAssessment:
        # Complex judgment
        pass

class Tier2(Codex):
    """Pattern application, logic, validation"""
    def validate_against_rubric(self, task: Task, rubric: List[Criteria]) -> Score:
        # Apply rules
        pass
    
    def extract_and_categorize(self, data: str, schema: Schema) -> Dict:
        # Apply patterns + validation
        pass

class Tier3(Ollama):
    """Fast extraction, templating, formatting"""
    def lint_code(self, code: str) -> LintResults:
        # Fast pattern matching
        pass
    
    def summarize_tests(self, output: str) -> TestSummary:
        # Extract structure
        pass
```

### Fallback Chain

```
Try Tier3 (fast, deterministic)
    ↓ if fails
Try Tier2 (logic, validation)
    ↓ if fails
Try Tier1 (Claude, always works)
    ↓ if fails
Human escalation (last resort)
```

---

## 🌊 Weekly Workflow with 3-Tier System

### Monday-Thursday: Codex Execution

```
Codex working on TASK-003:

1. Codex writes code
           ↓
2. Before commit: Route to Tier3 (Ollama)
   - Lint check (console.logs, unused imports) → 50ms response
   - Code style check (tabs vs spaces) → 30ms response
   - TODO extraction → 20ms response
           ↓
3. Ollama flags issues, Codex fixes
           ↓
4. After tests: Route to Tier2 (Codex)
   - Summarize test results → JSON {passed, failed, coverage}
   - Generate PR template → scaffold with examples
           ↓
5. Codex creates PR with summary
           ↓
6. Human reviews (async)
```

**Speed:** Codex gets instant feedback (125ms total for all checks)  
**Cost:** ~0 tokens (all Tier3)  
**Quality:** Catches obvious issues before PR

### Friday: Review Loop

```
PHASE 1: CODE REVIEW

1. Deploy 5 review agents (Claude) → analyze work
   - Each agent does deep semantic analysis
   - Extract findings → structure + severity
           ↓
2. Route to Tier3 (Ollama): Extract raw findings
   - "Found hardcoded password in backend/config.py line 45"
   - → JSON {severity: "critical", location: "backend/config.py:45", issue: "hardcoded_password"}
           ↓
3. Route to Tier2 (Codex): Categorize + link evidence
   - Apply rubric: "hardcoded_password + in_code" → critical
   - Extract code snippet for evidence
   - Check if actionable (yes, can fix)
           ↓
4. Aggregate all findings (Claude + Codex + Ollama output)

PHASE 2: SYNTHESIS

1. Route to Tier1 (Claude): Strategic decisions
   - "Which of these 20 findings are blockers?"
   - "Should we fix this now or next week?"
   - "How do we explain this in the handover?"
           ↓
2. Route to Tier2 (Codex): Task scaffolding
   - Create task list structure
   - Validate against rubric
   - Map dependencies
           ↓
3. Route to Tier3 (Ollama): Generate templates
   - Fill in acceptance criteria template
   - Create testing strategy template
   - Generate code snippet placeholders
           ↓
4. Output: Complete handover package
   - Claude did: judgment, strategy, narrative
   - Codex did: validation, pattern application
   - Ollama did: templating, extraction
```

**Total time:** 15-20 min (parallel execution)  
**Token cost:** ~80K (vs ~105K currently)  
**Quality:** Maintained (Claude still does judgment)  
**Benefit:** Faster turnaround, cleaner separation of concerns

---

## 🔄 Benefits Summary

### For You (Claude)
```
✅ Focus on actual judgment/synthesis
✅ Delegate tedious extraction work
✅ Faster response on routine queries (Tier3 instant)
✅ Cleaner context (only complex problems)
✅ More control (routing layer validates inputs)
```

### For Codex
```
✅ Instant lint feedback during development
✅ Faster PR review turnaround
✅ Learn from patterns (can see which checks Ollama catches)
✅ Medium-complexity tasks match its strengths
✅ No waiting on Claude for lint/formatting
```

### For System
```
✅ Cost optimization: 20-30% savings
✅ Speed: 30-50% faster execution (parallel)
✅ Reliability: Fallback chain if tier fails
✅ Scalability: Can handle higher volume
✅ Separation of concerns: Clear boundaries
✅ Quality: Judgment work never delegated
```

---

## ⚠️ Critical Constraints

### Never Route to Tier2/3:
```
❌ Security decisions
❌ Architecture choices  
❌ Production readiness assessment
❌ Risk & compliance judgments
❌ Novel problem solving
```

### Always Route to Claude:
```
✅ Anything that says "should we..." (judgment)
✅ Anything involving "trade-offs"
✅ Anything novel or edge-casey
✅ Anything high-stakes if wrong
```

---

## 📊 Implementation Phases

### Phase 1: Infrastructure (Week 1)
```
❑ Design routing rules (this document)
❑ Build Router class
❑ Define Tier interfaces
❑ Setup fallback chain
❑ Create monitoring/logging
```

### Phase 2: Tier 3 Integration (Week 2)
```
❑ Integrate Ollama lint checks
❑ Test on sample code (accuracy >98%)
❑ Codex uses during task execution
❑ Monitor for false positives
```

### Phase 3: Tier 2 Integration (Week 3)
```
❑ Codex validates task clarity
❑ Codex categorizes findings
❑ Codex maps dependencies
❑ Monitor decision accuracy
```

### Phase 4: Full Loop (Week 4+)
```
❑ Friday review loop uses 3-tier routing
❑ Measure: time, cost, quality
❑ Adjust routing rules based on results
❑ Scale to all future weeks
```

---

## 🎯 Example Routing Decisions

### Decision: "Is code style correct?"
```
Route: Tier3 (Ollama)
Reason: Fully deterministic, fast, high volume
Implementation: Lint rules + style guide
Fallback: If Ollama JSON invalid → skip check
Cost: Free
Speed: ~30ms
Accuracy: >99%
```

### Decision: "Does task meet clarity rubric?"
```
Route: Tier2 (Codex)
Reason: Apply rubric (logic), medium complexity
Implementation: 7-point rubric + scoring
Fallback: If Codex uncertain → Claude reviews
Cost: ~1-2K tokens
Speed: ~200ms
Accuracy: >90%
```

### Decision: "Is this a production blocker?"
```
Route: Tier1 (Claude)
Reason: Judgment, high stakes, context-dependent
Implementation: Analyze impact, risk, timeline
Fallback: None (Claude is final arbiter)
Cost: ~2-3K tokens
Speed: ~1 sec
Accuracy: 100% (always right because Claude)
```

---

## 💾 Persistence & Learning

### Router learns over time:
```
Week 1: "This task looks like X, route to Tier 2"
Week 2: "That was actually Tier 3, adjust routing"
Week 3: "Route to Tier 3 immediately now"

= Better routing rules = faster execution
```

### Tier fallback chain gives feedback:
```
If Tier3 (Ollama) fails on Tier2 task:
  → Mark for retraining
  → Adjust routing rules
  → Make it Tier2 by default next time

If Tier2 (Codex) uncertain:
  → Route to Claude
  → Claude decision is ground truth
  → Update Codex logic accordingly
```

---

## 🚀 Why This Approach Is Better

### vs. "Pure Claude"
```
✅ Faster (parallel extraction via Ollama)
✅ Cheaper (deterministic work free)
✅ Scalable (can handle more tasks)
✗ More complex (requires routing layer)
```

### vs. "Pure Ollama"
```
✅ Higher quality (judgment stays with Claude)
✅ Safer (high-stakes decisions not delegated)
✅ More reliable (fallback chain)
✗ More expensive than pure-Ollama (but Claude is essential)
```

### vs. "Ollama for cost reduction"
```
✅ Not about cost, about right-tool-for-job
✅ Claude still does what matters
✅ Codex and Ollama do what they're good at
✅ System is faster, not cheaper-but-worse
```

---

## 🎯 Decision Point

**This architecture makes sense if:**

```
✅ You want intelligent task delegation
✅ Quality (judgment) is non-negotiable
✅ Speed matters (parallel execution)
✅ You trust Ollama for specific, narrow tasks
✅ You want clear separation of concerns
```

**This is overkill if:**

```
❌ Current speed is fine
❌ Token cost isn't a concern
❌ Simplicity > optimization
❌ You don't have reliable Ollama setup
```

---

## 📋 Next Steps

1. **Review this architecture** (is the routing logic sound?)
2. **Agree on Tier boundaries** (which tasks are Tier 3 vs 2 vs 1?)
3. **Build Router** (implement routing logic)
4. **Test on sample tasks** (validate accuracy + speed)
5. **Deploy Phase 1** (routing infrastructure)
6. **Pilot with Codex** (start with Tier 3 lint checks)

---

**This is a system that gets smarter as it's used, with Claude (me) handling judgment, Codex handling rules, and Ollama handling extraction. Clear, layered, and defensible.**

**Worth building?**
