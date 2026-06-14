# 🔧 Week 2 START HERE - Infrastructure & Security Hardening

**For:** Claude Code (Codex) Local Session  
**Date:** 2026-06-10  
**Status:** Ready to Begin  
**Week Focus:** Infrastructure, Security, Testing, Production Readiness

---

## Welcome Back! 👋

You're Codex. Last week you crushed 10 tasks and built the complete guest management feature. This week is different—instead of shipping features, you're building the foundation that makes everything else possible.

**Week 1 was about:** Features that users see  
**Week 2 is about:** Infrastructure, security, and reliability users depend on

---

## The Mission (In 30 Seconds)

Harden the system for production with:
- **Security fixes** (CORS, environment variables, credentials)
- **Infrastructure improvements** (database indexes, constraints, triggers)
- **CI/CD pipeline** (automated testing, deployment)
- **Comprehensive testing** (unit, integration, E2E)
- **Monitoring & logging** (observability, debugging)

**Timeline:** 1 week (9 days to complete all tasks)  
**This Week:** Complete 12-15 infrastructure & security tasks  
**Success Metric:** System ready for production deployment

---

## This Week's Mission: 12-15 Tasks

| Category | Task Count | Focus |
|----------|-----------|-------|
| Security Fixes | 3 tasks | CORS, env vars, credentials |
| Database Remediation | 3 tasks | Indexes, constraints, triggers |
| CI/CD Pipeline | 3 tasks | GitHub Actions, automated testing |
| Testing Infrastructure | 3 tasks | Test coverage, fixtures, mocking |
| Monitoring & Logging | 3 tasks | Application logs, error tracking |
| **TOTAL** | **15 tasks** | **Infrastructure hardening** |

**Total Estimated Time:** 25-30 hours (staggered throughout week)

---

## Four Documents You MUST Read

1. **WEEK_2_HANDOVER_GUIDE.md** ← READ FIRST
   - Current state assessment
   - Infrastructure patterns
   - Security best practices
   - Database optimization strategies
   - CI/CD concepts
   - Testing infrastructure patterns

2. **WEEK_2_TASK_LIST.md** ← YOUR TASK LIST
   - 15 specific infrastructure tasks
   - Detailed acceptance criteria
   - Code examples for each pattern
   - Testing strategies
   - Deployment considerations

3. **WEEK_2_OLLAMA_QUICK_START.md** ← NEW: LOCAL FEEDBACK LOOP
   - How to use Ollama for instant code feedback
   - Lint checks (before commit)
   - Test summary extraction (after tests)
   - Optional integration (you can skip if preferred)

4. **WEEK_2_COMPLETION_CRITERIA.md** ← SUCCESS METRICS
   - Production readiness scorecard
   - Sign-off checklist
   - Week 2 completion definition
   - Risk assessment post-hardening

---

## Why Week 2 Matters

### The Problem We're Solving

**Week 1 state:**
```
✅ Features work locally
❌ No automated testing
❌ Weak security posture
❌ No database optimization
❌ Manual deployment process
❌ No error visibility
```

**Week 2 goal:**
```
✅ Features work in production
✅ Automated testing & deployment
✅ Security hardened
✅ Database optimized
✅ Self-healing observability
✅ Confidence in deployments
```

### What Breaks Without Week 2

1. **Security:** CORS misconfiguration exposes API to attacks
2. **Performance:** Missing database indexes slow queries 100x
3. **Reliability:** No CI/CD means manual errors in production
4. **Debugging:** Missing logs make production issues invisible
5. **Maintainability:** Lack of test coverage breaks code confidence

---

## The Difference: Week 2 is Infrastructure Work

### Week 1: Feature Development Loop
```
1. Read task
2. Build feature
3. Test in browser
4. Create PR
5. Merge to main
```

### Week 2: Infrastructure Loop (Different!)
```
1. Read task
2. Implement fix/improvement
3. Run automated tests
4. Verify in CI/CD pipeline
5. Confirm production readiness
6. Create PR
7. Merge to main
```

**Key differences:**
- ✅ You'll run pytest/npm test more often
- ✅ You'll verify GitHub Actions workflows
- ✅ You'll check database behavior directly
- ✅ You'll validate security configurations
- ✅ Less UI testing, more command-line validation

---

## Your Workflow (The Loop - Slightly Different)

```
1. Read task from WEEK_2_TASK_LIST.md
   ↓
2. Create feature branch: git checkout -b security/task-name
   ↓
3. Implement infrastructure fix/improvement
   ↓
4. Test THOROUGHLY (pytest, npm test, curl, psql)
   ↓
5. Validate: "Does it meet acceptance criteria?"
   ↓
6. Verify in CI/CD environment (if applicable)
   ↓
7. Commit: git commit -m "fix(security): description"
   ↓
8. Push: git push -u origin security/task-name
   ↓
9. Create PR on GitHub with full description
   ↓
10. Wait for human review & approval
   ↓
11. Human validates in staging/test environment
   ↓
12. Human merges PR to main
   ↓
13. Move to next task
```

---

## Right Now: Do This

### Step 1: Understand Week 2 Focus (5 min)
Read the next section: **What's Different About Week 2**

### Step 2: Read Infrastructure Concepts (10 min)
Read: **WEEK_2_HANDOVER_GUIDE.md**
- Sections: Infrastructure Patterns, Security Best Practices, Database Optimization

### Step 3: Get Your Task List (5 min)
Read: **WEEK_2_TASK_LIST.md**
- Section: TASK-001 (Critical Security Fix: CORS Configuration)

### Step 4: Understand Success (3 min)
Read: **WEEK_2_COMPLETION_CRITERIA.md**
- Section: Production Readiness Scorecard

### Step 5: Start Task 1 (60-90 min)
Open terminal:
```bash
ssh deploy@192.168.0.32
cd ~/wedding-dashboard
# Follow TASK-001 instructions from WEEK_2_TASK_LIST.md
```

---

## What's Different About Week 2

### Task Type: Infrastructure ≠ Features

**Feature Task (Week 1):**
- Visible to end users
- Can be tested in browser
- Usually frontend or API endpoint
- Time: 30-90 minutes
- Verification: "Does UI work?"

**Infrastructure Task (Week 2):**
- Invisible to end users (but critical)
- Tested via automation and configuration
- Usually backend, database, or CI/CD
- Time: 60-120 minutes
- Verification: "Does it pass security audit?"

### Testing is Different

**Week 1 Testing:**
```bash
curl http://localhost:3001/api/guests
# Did the API respond? ✅
```

**Week 2 Testing:**
```bash
# Check security headers
curl -I http://localhost:3001/api/guests | grep CORS

# Check database performance
EXPLAIN ANALYZE SELECT * FROM guests WHERE email = 'test@test.com';

# Check CI/CD pipeline
gh workflow view -w "test.yml"

# Check error logging
tail -f /var/log/wedding-dashboard/app.log
```

---

## This Week's 15 Tasks

### Security Fixes (Tasks 001-003)
| Task | Focus | Impact |
|------|-------|--------|
| TASK-001 | Fix CORS misconfiguration | Prevent cross-origin attacks |
| TASK-002 | Secure environment variables | Protect credentials & API keys |
| TASK-003 | Credential rotation & secrets | Remove hardcoded secrets |

### Database Optimization (Tasks 004-006)
| Task | Focus | Impact |
|------|-------|--------|
| TASK-004 | Add database indexes | 10-100x query speedup |
| TASK-005 | Add constraints & validation | Data integrity |
| TASK-006 | Create database triggers | Audit logging & automation |

### CI/CD Pipeline (Tasks 007-009)
| Task | Focus | Impact |
|------|-------|--------|
| TASK-007 | Setup GitHub Actions | Automated testing |
| TASK-008 | Automated deployment | Manual error reduction |
| TASK-009 | Environment config | Reproducible deployments |

### Testing Infrastructure (Tasks 010-012)
| Task | Focus | Impact |
|------|-------|--------|
| TASK-010 | Unit test fixtures | 20% faster test writing |
| TASK-011 | Integration test patterns | End-to-end confidence |
| TASK-012 | E2E test automation | Regression prevention |

### Monitoring & Logging (Tasks 013-015)
| Task | Focus | Impact |
|------|-------|--------|
| TASK-013 | Application logging | Production visibility |
| TASK-014 | Error tracking | Quick issue identification |
| TASK-015 | Performance monitoring | Bottleneck detection |

---

## Key Rules for Week 2

### DO ✅
- Test infrastructure changes thoroughly
- Write/update automation for each task
- Document security decisions
- Verify in both test and dev environments
- Create comprehensive PRs explaining WHY
- Ask questions about production implications
- Take time to understand each concept

### DON'T ❌
- Skip security validations
- Deploy infrastructure changes without testing
- Ignore error messages in CI/CD
- Leave hardcoded credentials anywhere
- Mix security + feature work in same PR
- Assume "it works locally" = "it works in production"
- Rush through infrastructure tasks

---

## Success Looks Like

```
Monday 10:00 - Start TASK-001 (CORS fix)
Monday 1:00 - Task 1 complete, PR created
Monday 2:00 - PR reviewed and merged

Monday 3:00 - Start TASK-004 (Database indexes)
Monday 5:00 - Task 4 complete, database validated
Tuesday 10:00 - PR merged after verification

...

Friday 12:00 - All 15 tasks complete
Friday 1:00 - Production readiness scorecard 100%
Friday 2:00 - Deployment pipeline validated
Friday 3:00 - Week 2 sign-off complete
```

---

## Success Metrics

By end of week:

```
Infrastructure Security
✅ CORS properly configured
✅ All environment variables externalized
✅ No hardcoded credentials
✅ Security headers added
✅ Rate limiting configured

Database
✅ All slow queries indexed
✅ Constraints on all relationships
✅ Audit triggers created
✅ Data integrity verified

CI/CD
✅ GitHub Actions workflows automated
✅ All tests run on every commit
✅ Deployment pipeline functional
✅ Staging matches production

Testing
✅ 90%+ code coverage
✅ Test fixtures reusable
✅ Integration tests comprehensive
✅ E2E tests automated

Observability
✅ Application logs in place
✅ Error tracking functional
✅ Performance metrics available
✅ Debug information accessible

Production Readiness
✅ System passes security audit
✅ Database optimized
✅ Deployment automated
✅ Team confident in production
```

---

## If You Get Stuck

**Check in this order:**

1. Reread the task description carefully
2. Check the handover guide for patterns
3. Look for similar infrastructure code in repo
4. Run diagnostic commands (logs, EXPLAIN, curl, etc.)
5. Review error messages line by line
6. Comment on PR: "Need help with X"
7. Wait for human feedback

**When stuck on infrastructure:**
- Don't guess at security settings
- Don't skip testing steps
- Don't assume it works without verification
- Do ask for clarification on production requirements

---

## Resources Available

**Documentation:**
- WEEK_2_HANDOVER_GUIDE.md - Infrastructure reference
- WEEK_2_TASK_LIST.md - All 15 tasks with code
- WEEK_2_COMPLETION_CRITERIA.md - Success definition
- CODEX_HANDOVER_GUIDE.md - Workflow refresher
- DEBUGGING_METHODOLOGY.md - Troubleshooting help

**Infrastructure Access:**
- VM: ssh deploy@192.168.0.32
- Database: psql postgresql://user:password@192.168.0.32:5432/wedding
- Frontend: http://192.168.0.32:3000
- Backend: http://192.168.0.32:3001
- GitHub Actions: https://github.com/VainAsher/ashley-hazel-wedding-portal/actions

**Tools for Week 2:**
```bash
# Database inspection
psql postgresql://user:password@192.168.0.32:5432/wedding
\dt                           # List tables
\d table_name                 # Inspect table
EXPLAIN ANALYZE SELECT ...;   # Query performance

# Security headers
curl -I http://localhost:3001/api/guests

# Log inspection
tail -f /var/log/wedding-dashboard/app.log
docker logs <container-id>

# Test running
pytest production/backend/tests/ -v --cov
npm test production/frontend/

# CI/CD inspection
gh workflow list
gh run list -w test.yml
```

---

## Communication with Your Human

**When starting infrastructure task:**
```
"Starting TASK-001: Fix CORS configuration.
Will test security headers and verify production patterns."
```

**When infrastructure work is done:**
```
"Task complete. PR created at [URL].
Security validated via:
- curl headers check ✅
- CORS preflight test ✅
- Development env verified ✅
Ready for production verification."
```

**When infrastructure work is blocked:**
```
"Blocked on TASK-004.
Question: Should database indexes be created manually or via migration?
[Explain what you tried and what failed]"
```

---

## Your First Task Right Now

### TASK-001: Critical Security Fix - CORS Configuration (90 min)

**Description:** Current CORS settings are too permissive. Restrict to production domain and implement proper security headers.

**Why it matters:** CORS misconfiguration allows attacks from any domain. We must restrict to legitimate sources.

**How to start:**
1. Open WEEK_2_TASK_LIST.md
2. Go to "TASK-001: Critical Security Fix - CORS Configuration"
3. Follow the instructions exactly
4. Test with curl and verify headers
5. Create PR with security validation notes

**Expected time:** 90 minutes  
**When done:** Create PR and wait for review

---

## Remember

**Week 2 is different because:**
- Features are done (guests feature is complete)
- Now we're building confidence in the system
- Infrastructure work is less visible but more critical
- You'll spend more time in terminal, less in browser
- Security decisions matter more than UI polish

**You're not alone:**
- Your human will review infrastructure choices
- They'll validate security improvements
- They'll test in production-like environment
- They'll provide feedback on patterns

**This work matters because:**
- Weak security = data breach
- Slow queries = unhappy users
- Manual deployment = production fires
- No tests = breaking existing features
- No visibility = debugging nightmare

---

## Let's Go! 🚀

1. **Read WEEK_2_HANDOVER_GUIDE.md** (15 min)
2. **Read WEEK_2_TASK_LIST.md** - TASK-001 section (10 min)
3. **Understand security requirements** (5 min)
4. **Start TASK-001** (90 min)
5. **Create PR** (5 min)
6. **Wait for review**

**Total to first PR: ~2 hours**

---

## Quick Reference: Week 2 Commands

```bash
# SSH to VM
ssh deploy@192.168.0.32

# Database work
psql postgresql://user:password@192.168.0.32:5432/wedding
SELECT * FROM guests;
EXPLAIN ANALYZE SELECT ...;

# Test running
cd production/backend
pytest tests/ -v --cov

cd production/frontend
npm test

# Security verification
curl -I http://localhost:3001/api/guests
curl -X OPTIONS -i http://localhost:3001/api/guests

# Log inspection
tail -f /var/log/wedding-dashboard/app.log
docker logs <container-id>

# Git workflow (same as Week 1)
git checkout -b security/task-name
git add production/
git commit -m "fix(security): description"
git push -u origin security/task-name
```

---

## The Human Will Do

- Review infrastructure changes
- Validate security improvements
- Test in staging environment
- Approve PRs
- Merge to main
- Provide feedback on patterns
- Help with production-specific decisions

---

## Questions Before You Start?

**Q: "What if I break something?"**
A: You're in a feature branch. Push anyway, tell human in PR. Infrastructure changes should be tested before merge.

**Q: "How much infrastructure is too much?"**
A: Follow the task list exactly. If it seems excessive, note that in PR.

**Q: "What if production requirements are unclear?"**
A: Ask in PR comment. Don't guess at security settings.

**Q: "Can I batch infrastructure tasks?"**
A: No. One task per PR. Infrastructure changes need individual review.

**Q: "Why does this take longer than Week 1?"**
A: Because infrastructure is invisible—you can't see the results in a browser. Testing takes longer.

---

## Let's Build Confidence in Our System! 🛡️

This week you're the one building the foundation. Next week, more features will stack on top of it. Make sure it's solid.

**You've got this! 💪**

---

**Next Step:** Read WEEK_2_HANDOVER_GUIDE.md sections on:
1. Current State Assessment
2. Infrastructure Patterns
3. Security Best Practices

Then start TASK-001.

**This week, we ship confidence. Let's go! 🚀**
