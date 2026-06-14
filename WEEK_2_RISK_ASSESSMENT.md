# 🎯 WEEK 2 RISK ASSESSMENT & MITIGATION STRATEGY

**Date:** 2026-06-10  
**Assessment Level:** HIGH (Pre-production hardening)  
**Risk Tolerance:** LOW (Security-critical tasks)  

---

## 📊 EXECUTIVE SUMMARY

| Category | Status | Risk | Confidence |
|----------|--------|------|-----------|
| Critical Blockers (3 tasks) | 🔴 MUST FIX | 🔴 HIGH | 🟢 HIGH |
| Database Hardening (4 tasks) | 🟡 HIGH | 🟡 MEDIUM | 🟢 HIGH |
| API Enhancement (3 tasks) | 🟡 HIGH | 🟡 MEDIUM | 🟢 HIGH |
| Infrastructure (4 tasks) | 🟠 MEDIUM | 🟢 LOW | 🟢 HIGH |
| **Overall** | **Ready** | **Manageable** | **High** |

---

## 🔴 CRITICAL RISKS

### RISK-001: .env Not Properly Ignored (Task 011)

**Severity:** 🔴 CRITICAL  
**Probability:** 🟡 MEDIUM (common mistake)  
**Impact:** Database credentials committed to git  

**Scenario:**
```bash
# Developer forgets to add .env to .gitignore
# Commits .env file with real passwords
# Passwords now in git history forever
# Anyone with git access has database password
```

**Mitigation:**
- [ ] Pre-commit hook prevents .env commits
- [ ] Verify with `git check-ignore .env`
- [ ] Search git history: `git log -S "DATABASE_URL"`
- [ ] Use github.com for credential scanning

**Recovery Plan:**
```bash
# If .env accidentally committed:
git filter-branch --tree-filter 'rm -f .env' HEAD
# This removes .env from entire history
# Force push only if team agrees
```

**Task 011 Acceptance Criteria Includes:**
- [ ] `git check-ignore .env` returns success
- [ ] Pre-commit hook prevents .env changes
- [ ] No credentials in git log

---

### RISK-002: CORS Wildcard Remains (Task 012)

**Severity:** 🔴 CRITICAL  
**Probability:** 🟢 LOW (clear acceptance criteria)  
**Impact:** Security vulnerability exploitable in production  

**Scenario:**
```
Attacker creates website: evil.com
Attacker writes: fetch('https://api.wedding.com/guests')
Browser allows request (CORS wildcard)
Attacker sees all guest data + RSVPs + dietary restrictions
```

**Mitigation:**
- [ ] Search codebase for `allow_origins=["*"]`
- [ ] Test with curl from unauthorized origin
- [ ] Automated test verifies CORS rejection

**Acceptance Criteria for Task 012:**
- [ ] `grep -r 'allow_origins=\["\*"\]' production/` returns NOTHING
- [ ] Test: `curl -H "Origin: http://evil.com"` gets NO Access-Control header
- [ ] Production URL can always be added later

---

### RISK-003: Database Migration Fails (Task 013)

**Severity:** 🔴 CRITICAL  
**Probability:** 🟡 MEDIUM (Alembic can be tricky)  
**Impact:** Cannot make schema changes; team blocked  

**Scenario:**
```
Developer creates Task 004 (add NOT NULL constraint)
Migration doesn't handle existing NULL values
Migration fails
Database locked, dev blocked
```

**Mitigation:**
- [ ] Test baseline migration on clean database
- [ ] Test downgrade works (reversible)
- [ ] Test upgrade on existing data
- [ ] Document migration best practices

**Task 013 Acceptance Criteria:**
- [ ] `alembic upgrade head` applies all migrations
- [ ] `alembic downgrade base` removes all tables
- [ ] `alembic upgrade head` re-creates schema identically
- [ ] Migration history in git

**Backup Plan if Migration Fails:**
```
1. Roll back to previous database state
2. Manually create migration following Alembic docs
3. Test with smaller data set first
4. If still broken, use raw SQL + manual tracking
   (not ideal, but unblocks the team)
```

---

## 🟡 HIGH PRIORITY RISKS

### RISK-004: Database Constraint Breaks Data (Task 004)

**Severity:** 🟡 HIGH  
**Probability:** 🟡 MEDIUM (if data doesn't match constraints)  
**Impact:** Migration fails, database inconsistent  

**Scenario:**
```sql
-- Try to add NOT NULL constraint to email column
-- But some existing guest records have NULL email
-- Migration fails: "column "email" contains NULL values"
```

**Mitigation:**
- [ ] Inspect existing data before adding constraint
- [ ] Clean up data in migration (set defaults, etc.)
- [ ] Test on copy of production database first

**Example Migration Handling NULL:**
```python
def upgrade():
    # First, set default value for NULLs
    op.execute("UPDATE guests SET email = 'unknown@example.com' WHERE email IS NULL")
    
    # Then add constraint
    op.alter_column('guests', 'email', nullable=False)

def downgrade():
    # Reverse: allow NULLs again
    op.alter_column('guests', 'email', nullable=True)
```

**Prevention in Task 004:**
- [ ] Query existing data: `SELECT COUNT(*) FROM guests WHERE email IS NULL`
- [ ] If any NULLs found, handle in migration
- [ ] Document data cleanup in commit message

---

### RISK-005: Alembic Configuration Conflict (Task 013)

**Severity:** 🟡 HIGH  
**Probability:** 🟢 LOW (straightforward setup)  
**Impact:** Migrations don't run; team can't deploy  

**Scenario:**
```
alembic/env.py not configured correctly
Environment variables not loaded
Migration runs against wrong database
Corrupts production data (nightmare)
```

**Mitigation:**
- [ ] Follow official Alembic tutorial exactly
- [ ] Test on development database only (first 10 times)
- [ ] Add guard: migration should show target database before running
- [ ] Never run on production database until tested 5x locally

**Task 013 Testing Strategy:**
```bash
# Only test on LOCAL database
PGPASSWORD='wedding_dev_2026' psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Should show all tables before migration

# Test downgrade first
alembic downgrade base
# Should remove all tables

# Test upgrade
alembic upgrade head
# Should recreate tables

# Verify schema
PGPASSWORD='wedding_dev_2026' psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Should match original
```

**Prevent Production Mistakes:**
- [ ] Add comment in alembic.ini: "DEV DATABASE ONLY"
- [ ] Different .env for production
- [ ] Require explicit flag to migrate production

---

### RISK-006: Connection Pool Starvation (Task 010)

**Severity:** 🟡 HIGH  
**Probability:** 🟢 LOW (known limits)  
**Impact:** Concurrent requests fail with "no connection available"  

**Scenario:**
```
pool_size=20 (20 concurrent connections)
100 requests come in simultaneously
80 requests timeout waiting for connection
API returns errors instead of responses
```

**Mitigation:**
- [ ] Set conservative limits: pool_size=20, max_overflow=10
- [ ] Monitor pool usage: `SELECT count(*) FROM pg_stat_activity`
- [ ] Load test to verify capacity
- [ ] Document tuning process

**Task 010 Acceptance Criteria:**
- [ ] Connection pooling configured
- [ ] Load test with 50 concurrent requests succeeds
- [ ] No "QueuePool timeout" errors in logs

---

### RISK-007: Rate Limit Too Restrictive (Task 008)

**Severity:** 🟡 HIGH  
**Probability:** 🟡 MEDIUM (hard to tune)  
**Impact:** Legitimate users blocked with 429 errors  

**Scenario:**
```
Rate limit: 5 requests/hour per IP
Wedding coordinator making many updates
After 5 updates, API returns 429 Too Many Requests
Coordinator frustrated, feature appears broken
```

**Mitigation:**
- [ ] Use reasonable defaults: 100/hour for public, 20/hour for mutations
- [ ] Different limits per endpoint type
- [ ] Document in API documentation
- [ ] Can be tuned in .env after feedback

**Task 008 Configuration:**
```python
# Public endpoints: 100 requests/hour per IP
@limiter.limit("100/hour")
def get_guests():
    pass

# Write operations: 20 requests/hour per IP
@limiter.limit("20/hour")
def create_guest():
    pass

# Can override in .env:
RATE_LIMIT_PUBLIC=100/hour
RATE_LIMIT_WRITE=20/hour
```

---

## 🟠 MEDIUM PRIORITY RISKS

### RISK-008: Frontend Test Fragility (Task 011)

**Severity:** 🟠 MEDIUM  
**Probability:** 🟡 MEDIUM (API mocks can break)  
**Impact:** Tests break on API changes (but don't catch bugs)  

**Scenario:**
```typescript
// Test mocks API response
global.fetch = vi.fn(() => 
  Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1 }) })
)

// But actual API returns different format
// Test passes, production fails
```

**Mitigation:**
- [ ] Use realistic API response shapes
- [ ] Test error cases too
- [ ] Don't over-mock; test real behavior
- [ ] Document mocking strategy

**Task 011 Best Practices:**
- [ ] Mock should match actual API contracts
- [ ] Test both success and error paths
- [ ] Test loading states
- [ ] Test validation errors

---

### RISK-009: CI/CD Doesn't Match Local (Task 012)

**Severity:** 🟠 MEDIUM  
**Probability:** 🟡 MEDIUM (environment differences)  
**Impact:** Tests pass locally but fail in CI  

**Scenario:**
```
Local: Python 3.11, PostgreSQL 15
CI: Python 3.9, PostgreSQL 13
Tests use features not in Python 3.9
CI fails, local passes
```

**Mitigation:**
- [ ] CI uses same versions as documented
- [ ] Requirements.txt pins versions
- [ ] .python-version file for consistency

**Task 012 Setup:**
```yaml
# .github/workflows/test.yml
jobs:
  backend:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11']  # Must match local
    services:
      postgres:
        image: postgres:15  # Must match production
```

---

### RISK-010: Error Logs Too Verbose (Task 013)

**Severity:** 🟠 MEDIUM  
**Probability:** 🟢 LOW (easy to adjust)  
**Impact:** Noise makes real issues hard to find  

**Scenario:**
```
log_level=DEBUG configured in production
Logs 1GB per day
Storage fills up
Server crashes
```

**Mitigation:**
- [ ] Production: log_level=INFO
- [ ] Development: log_level=DEBUG
- [ ] Separate logs by component
- [ ] Implement log rotation

**Task 013 Configuration:**
```python
import logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),  # Env-configurable
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', maxBytes=10_000_000, backupCount=5),
        logging.StreamHandler()
    ]
)
```

---

## 🟢 LOW PRIORITY RISKS

### RISK-011: Code Review Workflow Too Strict (Task 014)

**Severity:** 🟢 LOW  
**Probability:** 🟢 LOW (just documentation)  
**Impact:** Slowdown in deployment velocity  

**Mitigation:**
- [ ] Require 1 review (not 2+)
- [ ] Auto-approve documentation changes
- [ ] Time-based auto-merge if approved (24 hours)

---

### RISK-012: Email Validation Too Strict (Task 009)

**Severity:** 🟢 LOW  
**Probability:** 🟢 LOW (email validation is standard)  
**Impact:** Valid emails rejected  

**Mitigation:**
- [ ] Use RFC 5322 compliant validation
- [ ] Still allow edge cases (+ addresses, subdomains)
- [ ] Test with real email examples

---

## 📊 DEPENDENCY RISK MATRIX

```
Task 011 (ENV)
└─ Required by: 001, 008, 009, 010
   Risk if blocked: 🔴 CRITICAL
   Mitigation: Start Monday 9am

Task 012 (CORS)
└─ Required by: All API calls
   Risk if blocked: 🔴 CRITICAL
   Mitigation: Simple fix, verify with curl

Task 013 (Migrations)
└─ Required by: 004, 005, 006, 007
   Risk if blocked: 🔴 CRITICAL
   Mitigation: Have SQL fallback

Task 004-007 (DB changes)
└─ Required by: Nothing critical
   Risk if blocked: 🟡 HIGH
   Mitigation: Can defer to Week 3

Task 008-010 (API hardening)
└─ Required by: Task 011
   Risk if blocked: 🟡 HIGH
   Mitigation: Can use manual limits initially

Task 011-014 (Infrastructure)
└─ Required by: Team processes
   Risk if blocked: 🟠 MEDIUM
   Mitigation: Can catch up in Week 3
```

---

## 🛡️ RISK MITIGATION STRATEGIES

### Pre-Task Checklist (For Codex)
```
Before starting any task:
☐ Read entire task card (not just summary)
☐ Understand acceptance criteria
☐ Understand testing strategy
☐ Identify potential blockers
☐ Know escalation path if stuck >30min
```

### During-Task Checklist
```
While implementing task:
☐ Test acceptance criteria
☐ Run tests locally
☐ Verify no regressions
☐ Write clear commit message
☐ Document any deviations
```

### Pre-PR Checklist
```
Before creating PR:
☐ All acceptance criteria met
☐ All tests passing
☐ No hardcoded values
☐ Documentation updated
☐ Commit message follows pattern
```

### Pre-Merge Checklist
```
Before merging to main:
☐ Code review completed
☐ CI/CD passes
☐ No security warnings
☐ Works in clean environment
☐ Documentation complete
```

---

## 📈 RISK TIMELINE

```
MONDAY - Highest Risk Period
├─ Task 011: Credential exposure risk (mitigate: pre-commit hook)
├─ Task 012: CORS bypass risk (mitigate: automated test)
└─ Task 013: Migration failure risk (mitigate: test on dev DB only)

TUESDAY - Medium Risk
├─ Tasks 004-007: Data corruption risk (mitigate: handle edge cases)
└─ No blocking tasks

WEDNESDAY - Low Risk
├─ Tasks 008-010: Config errors (mitigate: environment-based)
└─ No blockers

THURSDAY-FRIDAY - Lowest Risk
├─ Tasks 011-014: Process changes (mitigate: documentation)
└─ Can recover if needed
```

---

## 🚨 CRITICAL SUCCESS FACTORS

1. **Complete Monday Tasks by EOD**
   - All 3 critical blockers must finish Monday
   - Database cannot change safely without Task 013
   - API cannot be called without Tasks 011-012

2. **Test All Database Migrations Locally**
   - Never test on production database
   - Always test downgrade (reversibility)
   - Use copy of production data if possible

3. **Verify CORS Explicitly**
   - Don't assume it works
   - Test from multiple origins
   - Curl test before merging

4. **Use Environment Variables**
   - .env should NEVER be committed
   - .env.example should be committed
   - Verify with `git check-ignore`

5. **Document Everything**
   - Each task creates documentation
   - Future developers must understand decisions
   - Migration guide must be comprehensive

---

## 🔄 TESTING STRATEGY BY TASK

| Task | Unit Tests | Integration | Load Test | Manual |
|------|-----------|-------------|-----------|--------|
| 011 | NA | ✅ Can load from .env | NA | ✅ Verify no hardcoded |
| 012 | NA | ✅ Test allowed/blocked origins | NA | ✅ Curl test |
| 013 | ✅ Migration pytest | ✅ upgrade/downgrade | NA | ✅ Schema verification |
| 004-007 | ✅ Migration tests | ✅ Data integrity | NA | ✅ Query verification |
| 008 | ✅ Rate limit tests | ✅ API under load | ✅ 1000 req/min | ✅ Verify 429 |
| 009 | ✅ Email validation tests | ✅ Form submission | NA | ✅ Invalid emails |
| 010 | ✅ Pool config tests | ✅ Concurrent requests | ✅ 50 concurrent | ✅ Monitor pool |
| 011 | ✅ Component tests | ✅ API mocks | NA | ✅ Manual UI test |
| 012 | NA | ✅ Workflow runs | NA | ✅ Check status badge |
| 013 | ✅ Log format tests | ✅ Structured logs | NA | ✅ Read log files |
| 014 | NA | NA | NA | ✅ Try to merge without review |

---

## 🎯 SUCCESS METRICS

### Week 2 Complete Means:
```
✅ Task 011 (Env): No credentials in code/git
✅ Task 012 (CORS): Wildcard removed, explicit whitelist
✅ Task 013 (Migrations): Can upgrade/downgrade schema
✅ Task 004-007 (DB): Constraints, indexes, triggers, normalized
✅ Task 008-010 (API): Rate-limited, pooled, validated
✅ Task 011-014 (Infra): Tests, CI/CD, logging, code reviews
✅ Zero critical/high risks remaining
✅ Ready for production deployment
```

---

## 📞 ESCALATION PROCEDURE

**If any task blocks >30 minutes:**

1. **Check task card** - Review troubleshooting section
2. **Run tests** - See actual error message
3. **Search codebase** - Find similar implementations
4. **Check git log** - See how similar things were done
5. **Ask for clarification** - Document the question
6. **Use fallback** - Refer to Escalation Paths section

**Escalate to human if:**
- Security vulnerability discovered
- Data corruption or loss
- Cannot resolve despite all above
- Need to change task scope
- Fundamental blocker preventing progress

**Message should include:**
- Task number and name
- What you tried
- Error messages
- What you need (clarity, code review, scope change)

---

## ✅ FINAL RISK ASSESSMENT

**Overall Risk Level:** 🟡 **MEDIUM** (manageable with proper process)

**Why Medium, Not Low?**
- Critical security issues to fix
- Database changes are high-stakes
- First time with Alembic migrations

**Why Medium, Not High?**
- Well-defined acceptance criteria
- Clear testing strategy for each task
- Codex has excellent track record (Week 1)
- Risk mitigation strategies documented
- Escalation paths clear

**Recommendation:** 🟢 **PROCEED** with execution
- Follow task cards exactly
- Complete Monday blockers first
- Escalate if anything unclear
- Document all decisions

---

**Assessment Date:** 2026-06-10  
**Risk Owner:** TBD (human)  
**Review Date:** TBD  
**Status:** ✅ Ready for execution

---

*Risk assessment completed. Week 2 is ready to begin.*
