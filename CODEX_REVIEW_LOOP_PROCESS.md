# 🔄 Codex Review Loop Process - Reusable Framework

**Version:** 1.0  
**Created:** 2026-06-10  
**Purpose:** Standardized process for reviewing completed weeks and preparing next week's work

---

## 🎯 Overview

This is a **repeatable 3-phase process** to review Codex's work and prepare for the next week:

```
END OF WEEK N
    ↓
PHASE 1: REVIEW (5 specialist agents)
    ├─ Technical review (code quality, architecture)
    ├─ Backend/Frontend assessment
    ├─ Database & infrastructure validation
    ├─ Test coverage & deployment readiness
    └─ Git history & team process
    ↓
PHASE 2: SYNTHESIZE (3 synthesis agents)
    ├─ Create task breakdown for Week N+1
    ├─ Identify blockers, risks, dependencies
    └─ Assessment of what's working/what needs fixing
    ↓
PHASE 3: HANDOVER (Create Week N+1 pack)
    ├─ START_HERE document
    ├─ Detailed handover guide
    ├─ Task list (12-15 scoped tasks)
    ├─ Completion criteria
    └─ Supporting documentation
    ↓
START OF WEEK N+1
    ↓
Codex begins execution with full specification
```

**Timeline:** 2-3 hours to complete full review/synthesis/handover process per week

---

## 📋 Phase 1: Review Process

### How to Execute

**Step 1: Deploy 5 Review Agents in Parallel**

Each agent specializes in one area:

```bash
# Agent 1: Frontend/UI Code Quality
Deploy agent with focus:
- Component architecture
- React patterns
- TypeScript usage
- Accessibility
- Performance
- Mobile responsiveness

# Agent 2: Backend/API Quality
Deploy agent with focus:
- FastAPI/framework patterns
- SQLAlchemy ORM design
- Pydantic validation
- Error handling
- API design
- Security practices

# Agent 3: Database & Schema
Deploy agent with focus:
- Normalization (1NF, 2NF, 3NF)
- Index strategy
- Foreign keys & relationships
- Query optimization
- Migration readiness
- Data integrity

# Agent 4: Testing & Deployment
Deploy agent with focus:
- Test coverage (unit/integration/E2E)
- CI/CD readiness
- Infrastructure as code
- Monitoring/logging
- Error handling
- Production checklist

# Agent 5: Git & Organization
Deploy agent with focus:
- Commit quality
- Branch strategy
- Code organization
- Team collaboration readiness
- Knowledge distribution
- Release management
```

**Step 2: Each Agent Reviews Specific Areas**

Agent prompt template:

```
Deep dive review of [AREA] from Week [N]:

Focus areas:
1. Code Quality Assessment
   - Score (1-10)
   - Strengths (what works well)
   - Weaknesses (what needs work)
   - Patterns observed

2. Production Readiness
   - What's ready for production
   - What needs work
   - Critical blockers (if any)
   - Security assessment

3. Replicability for Next Week
   - Can patterns be reused
   - Are templates established
   - What needs to be standardized

4. Risk Assessment
   - What could go wrong
   - Dependencies on other systems
   - Technical debt introduced

5. Recommendations for Week [N+1]
   - High priority fixes
   - New patterns to establish
   - Team process improvements

Review the actual code/git/tests at:
[SSH command to VM]
[Specific file paths]

Provide:
- Specific scores (1-10)
- Evidence from code review
- Actionable recommendations
- Risk assessment with mitigations
```

**Step 3: Capture Findings**

Create a summary document from each agent's output:

```markdown
# Week [N] Review Summary

## Agent 1: Frontend Code Quality
- Score: X/10
- Key Findings: [bullet points]
- Blockers: [if any]
- Recommendations: [for Week N+1]

## Agent 2: Backend API Quality
...

## Agent 3: Database & Schema
...

## Agent 4: Testing & Deployment
...

## Agent 5: Git & Organization
...

## Cross-Cutting Issues
- [Issues that affect multiple areas]

## Risk Assessment (Overall)
- Critical: [list]
- High: [list]
- Medium: [list]
```

---

## 🔀 Phase 2: Synthesis Process

### How to Execute

**Deploy 3 Synthesis Agents to Create Week N+1 Plan**

**Agent 1: Task Breakdown & Implementation Plan**

```
Using findings from 5 review agents:

1. Identify what worked well in Week N
   → Replicate in Week N+1

2. Identify blockers and critical issues
   → Create tasks to fix them
   
3. Identify new features/domains to add
   → Create implementation tasks

4. Map dependencies
   → What tasks must complete before others
   
5. Break into 12-15 scoped tasks
   → Each 1-2 hours max
   → Clear acceptance criteria
   → Independent where possible

Output:
- WEEK_[N+1]_ACTION_PLAN.md (task list with dependencies)
- Risk mitigation for each blockers
- Execution timeline (Monday-Friday)
```

**Agent 2: Production Readiness & Security Assessment**

```
Using findings from review agents:

1. Assess current production readiness
   - % complete
   - Blockers
   - Timeline to launch
   
2. Identify security issues
   - Severity (critical/high/medium)
   - Required fixes
   - Effort estimates
   
3. Create comprehensive checklist
   - All requirements for production
   - Status of each item
   - Owner and timeline
   
4. Risk assessment
   - What could go wrong
   - Impact if deployed now
   - Mitigation strategies

Output:
- PRODUCTION_READINESS_CHECKLIST.md (200+ items)
- PRODUCTION_READINESS_EXECUTIVE_SUMMARY.md
- Risk matrix and mitigation plans
```

**Agent 3: Codex Handover Package Generation**

```
Using task breakdown and readiness assessment:

1. Create WEEK_[N+1]_START_HERE.md
   - 300-400 lines
   - Quick 60-second mission overview
   - Week's 12-15 tasks listed
   - Success metrics
   - Quick start guide

2. Create WEEK_[N+1]_HANDOVER_GUIDE.md
   - 1,000+ lines
   - Current state assessment
   - Patterns & best practices for this week
   - Code examples
   - Common pitfalls
   - Solutions reference

3. Create WEEK_[N+1]_TASK_LIST.md
   - 2,000+ lines
   - 12-15 detailed task cards
   - Each with: description, acceptance criteria, code, testing, blockers
   - Dependencies mapped
   - Success metrics

4. Create WEEK_[N+1]_COMPLETION_CRITERIA.md
   - 400+ lines
   - What "done" looks like
   - Validation checklist
   - Sign-off template
   - Next week's preview

Output:
- 6 complete documents (~5,500+ lines)
- Ready for Codex to begin Week N+1
```

---

## 📦 Phase 3: Handover Package Contents

Every week gets same structure (makes it familiar to Codex):

```
WEEK_[N]_START_HERE.md
├─ Welcome message
├─ This week's mission (30-60 sec read)
├─ Task overview (12-15 tasks)
├─ Success metrics
├─ Quick start guide
└─ "You've got this!" motivation

WEEK_[N]_HANDOVER_GUIDE.md
├─ Current state assessment
├─ What worked from last week
├─ New patterns for this week
├─ Security/architecture best practices
├─ Code examples (5-10)
├─ Common pitfalls
├─ Troubleshooting guide
└─ Communication protocols

WEEK_[N]_TASK_LIST.md
├─ TASK-001 through TASK-015
├─ Each task:
│  ├─ Description (1-2 sentences)
│  ├─ Acceptance criteria (checklist)
│  ├─ Implementation notes (with code)
│  ├─ Testing strategy
│  ├─ Files to create/modify
│  ├─ Branch name
│  ├─ Commit message template
│  ├─ Blockers & dependencies
│  └─ Time estimate
└─ Task dependency graph

WEEK_[N]_COMPLETION_CRITERIA.md
├─ Week N success definition
├─ 100+ checkpoint items
├─ Status tracking
├─ Sign-off checklist
├─ Week N+1 preview
└─ Risk assessment (before/after)

WEEK_[N]_SUPPORTING_DOCS.md (bonus)
├─ API documentation
├─ Architecture diagrams
├─ Database schema updates
├─ Deployment procedures
└─ Monitoring setup

README.md (navigation)
└─ Quick index of all documents
```

---

## 🔄 When to Run This Process

**Every Friday (End of Week):**

1. **3 PM:** Deploy 5 review agents
2. **4 PM:** Review agent outputs
3. **5 PM:** Deploy 3 synthesis agents
4. **6 PM:** Compile Week N+1 handover package

**Preparation for Monday Morning:**
- All Week N+1 documents ready
- Codex can start immediately with `START_HERE.md`

---

## 📊 Consistency Template

To ensure consistency across all weeks, use this template:

### **Week Template Checklist**

```
WEEK [N] DELIVERABLES:

Documents Created:
☐ WEEK_[N]_START_HERE.md (400-500 lines)
☐ WEEK_[N]_HANDOVER_GUIDE.md (1,000-1,200 lines)
☐ WEEK_[N]_TASK_LIST.md (2,000-2,500 lines)
☐ WEEK_[N]_COMPLETION_CRITERIA.md (400-600 lines)
☐ Supporting docs (API, architecture, etc.)

Quality Checks:
☐ All tasks 1-2 hours max
☐ All acceptance criteria clear
☐ All code examples tested/verified
☐ All blockers/dependencies mapped
☐ Timeline realistic (18-30 hours)
☐ Success metrics quantified

Codex Readiness:
☐ START_HERE is 60-second readable
☐ Task list matches actual work needed
☐ Code examples match current patterns
☐ Common pitfalls documented
☐ Success looks like [specific metrics]
☐ Next week preview clear
```

---

## 💾 Storage & Organization

**Location:** `C:\dev\ashley-hazel-wedding-portal-prototype\`

```
/
├── CODEX_REVIEW_LOOP_PROCESS.md (this file)
│
├── /WEEK_1/
│   ├── START_HERE_CODEX.md
│   ├── CODEX_HANDOVER_GUIDE.md
│   ├── CODEX_TASK_LIST.md
│   └── ... (completion, validation, etc.)
│
├── /WEEK_2/
│   ├── WEEK_2_START_HERE.md
│   ├── WEEK_2_HANDOVER_GUIDE.md
│   ├── WEEK_2_TASK_LIST.md
│   └── ...
│
├── /WEEK_3/ through /WEEK_9/
│   └── [same structure]
│
└── /REVIEWS/
    ├── Week_1_Review_Summary.md
    ├── Week_2_Review_Summary.md
    └── ... (ongoing reviews)
```

**Naming Convention:**
- Week 1 uses original names (START_HERE_CODEX.md, CODEX_HANDOVER_GUIDE.md)
- Week 2+ use consistent pattern (WEEK_[N]_DOCUMENT.md)
- All reviews stored in /REVIEWS/ folder

---

## 🎯 Key Success Factors

**For Codex to Succeed Each Week:**

1. ✅ **Clear Mission** (in START_HERE)
   - What's this week about
   - Why it matters
   - Success looks like...

2. ✅ **Detailed Tasks** (in TASK_LIST)
   - Each task 1-2 hours
   - Clear acceptance criteria
   - Code examples provided
   - Testing strategy included

3. ✅ **Pattern Consistency**
   - Same document structure each week
   - Codex knows where to find things
   - Familiar workflow

4. ✅ **Risk Awareness**
   - Known blockers listed upfront
   - Dependencies mapped
   - Escalation procedures clear

5. ✅ **Validation Framework**
   - How to know "done"
   - Success metrics quantified
   - Sign-off checklist

---

## 🚀 Running the Review Loop

### Quick Reference: Copy-Paste Prompts

**To run full review loop for Week N:**

1. **Deploy Review Agents:**
```bash
Agent 1: Frontend Code Quality
Agent 2: Backend API Quality
Agent 3: Database & Schema
Agent 4: Testing & Deployment
Agent 5: Git & Organization

[Use agent prompts from Phase 1 above]
```

2. **Deploy Synthesis Agents:**
```bash
Agent 1: Task Breakdown & Implementation Plan
Agent 2: Production Readiness & Security Assessment
Agent 3: Codex Handover Package Generation

[Use agent prompts from Phase 2 above]
```

3. **Compile and Organize:**
- Create `/WEEK_[N+1]/` folder
- Place all generated documents
- Create README.md index
- Verify completeness against template

---

## 📈 Metrics to Track

**After Each Week:**

```
WEEK [N] COMPLETION METRICS:

Code Quality:
- Overall code quality score (1-10)
- Test coverage %
- Production readiness %
- Critical blockers remaining

Velocity:
- Tasks completed vs. planned
- Average task time
- Deployment success rate

Team/Process:
- Code review turnaround time
- PR merge rate
- Knowledge distribution

Risk/Technical Debt:
- New blockers introduced
- Technical debt score
- Security issues found/fixed

Codex Performance:
- Task success rate
- Code quality consistency
- Ability to work independently
```

---

## ✨ Benefits of This Process

✅ **Consistent Quality** - Same structure every week  
✅ **Scalable** - Works for any project, any team size  
✅ **Automated** - Use agents to generate all documentation  
✅ **Transparent** - Clear visibility into progress  
✅ **Replicable** - Same process, same quality, every week  
✅ **Efficient** - 2-3 hours to review + plan entire week  
✅ **Codex-Optimized** - Structure familiar to Codex  
✅ **Risk-Aware** - Blockers identified early  

---

## 🔄 Continuous Improvement

**After running the loop 2-3 times:**

- [ ] Collect feedback from Codex
- [ ] Adjust task sizing if needed
- [ ] Update patterns based on what works
- [ ] Improve code examples
- [ ] Enhance documentation

**Version Control for Process:**
- v1.0 (Current) - Initial framework
- v1.1 - After Week 2 feedback
- v1.2 - After Week 3 feedback
- etc.

---

**Next: See WEEK_3_HANDOVER_PACK for complete Week 3 materials generated using this framework**

