# 🎯 Codex Handover Guide - Wedding Dashboard Development

**Created:** 2026-06-10  
**For:** Claude Code (Codex) Local Session  
**Project:** Wedding Dashboard  
**Target:** MVP Launch 2026-08-15

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Current State](#current-state)
3. [Workflow Process](#workflow-process)
4. [Task Breakdown System](#task-breakdown-system)
5. [Branch Strategy](#branch-strategy)
6. [Task Template](#task-template)
7. [Implementation Loop](#implementation-loop)
8. [Validation Checklist](#validation-checklist)
9. [Review Process](#review-process)
10. [Week 1 Task List](#week-1-task-list)

---

## 🎯 Project Overview

**Project:** Wedding Dashboard - Full-stack wedding planning platform  
**Tech Stack:**
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Frontend: React + TypeScript + Vite
- Infrastructure: Proxmox VM (192.168.0.32) with Docker/K8s ready

**Current Status:** ✅ Environment fully operational and browser-validated  
**Timeline:** 9 weeks to MVP (2026-08-15)  
**Team:** Human user + Codex (you)

**Repository:** https://github.com/VainAsher/ashley-hazel-wedding-portal  
**Monorepo Structure:**
```
ashley-hazel-wedding-portal/
├── /prototype/              (UI/UX design - separate track)
└── /production/             (Full-stack app)
    ├── /backend/            (FastAPI)
    ├── /frontend/           (React)
    └── /database/           (PostgreSQL)
```

---

## ✅ Current State

### Environment Status
```
✅ Frontend: http://192.168.0.32:3000 (RUNNING, VALIDATED)
✅ Backend: http://192.168.0.32:3001 (RUNNING, RESPONDING)
✅ Database: 192.168.0.32:5432 (RUNNING, SCHEMA READY)
✅ Git: Main branch clean, pushed to GitHub
```

### What Exists
- ✅ Database schema designed (11 tables)
- ✅ Vite dev server configured
- ✅ FastAPI base app running
- ✅ React app rendering
- ✅ Git workflow established
- ✅ Ansible playbook for reproducibility

### What Doesn't Exist Yet
- ❌ Database schema imported
- ❌ SQLAlchemy models
- ❌ API endpoints
- ❌ Frontend pages
- ❌ Authentication
- ❌ Business logic

---

## 🔄 Workflow Process

### The Loop: Test → Implement → Validate → Review

```
┌─────────────────────────────────────────────────────────┐
│                   CODEX TASK LOOP                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. READ TASK                                           │
│     ↓                                                   │
│  2. CREATE FEATURE BRANCH (feature/task-name)           │
│     ↓                                                   │
│  3. IMPLEMENT CODE                                      │
│     ↓                                                   │
│  4. TEST LOCALLY (curl, npm test, pytest)              │
│     ↓                                                   │
│  5. VALIDATE (all success criteria met)                │
│     ↓                                                   │
│  6. COMMIT (with proper message)                        │
│     ↓                                                   │
│  7. PUSH (to feature branch)                           │
│     ↓                                                   │
│  8. CREATE PR (with checklist)                         │
│     ↓                                                   │
│  9. WAIT FOR HUMAN REVIEW                             │
│     ↓                                                   │
│  10. HUMAN RUNS PR LOCALLY & VALIDATES                │
│      ↓                                                  │
│  11. HUMAN APPROVES & MERGES                          │
│      ↓                                                  │
│  12. UPDATE DOCUMENTATION                             │
│      ↓                                                  │
│  13. NEXT TASK                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Task Breakdown System

### Task Hierarchy

```
EPIC (Week)
├─ STORY (Feature Group)
│  ├─ TASK #1 (Scoped work item) ← 1-2 hours max
│  ├─ TASK #2 (Scoped work item) ← 1-2 hours max
│  └─ TASK #3 (Scoped work item) ← 1-2 hours max
├─ STORY (Feature Group)
│  └─ TASK #4
```

### Task Scope Rules

**Each task MUST be:**
- ✅ Completable in 1-2 hours
- ✅ Testable (has success criteria)
- ✅ Reviewable (small PR)
- ✅ Independent (can stand alone)
- ✅ Documented (clear acceptance criteria)

**Each task MUST NOT:**
- ❌ Block other tasks
- ❌ Require external dependencies
- ❌ Touch multiple systems
- ❌ Have unclear success criteria
- ❌ Be "too big to complete today"

---

## 🌿 Branch Strategy

### Branch Naming
```
feature/task-name          - New feature work
fix/issue-name             - Bug fixes
chore/task-name            - Maintenance
docs/task-name             - Documentation
```

### Branch Rules
1. **Always branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/task-name
   ```

2. **One task = one branch**
   - No mixing multiple tasks in one branch
   - One task = one PR

3. **Push frequently**
   ```bash
   git add production/
   git commit -m "feat(domain): clear description"
   git push -u origin feature/task-name
   ```

4. **Create PR when done**
   ```
   Title: Brief description
   Body: Task checklist + testing notes
   ```

---

## 📋 Task Template

Use this template for EVERY task:

```markdown
# TASK-XXX: [Domain] - [Action]

**Epic:** [Week]  
**Story:** [Feature Group]  
**Estimate:** 1-2 hours  
**Difficulty:** Easy/Medium/Hard  

## Description
Clear explanation of what needs to be built.

## Acceptance Criteria
- [ ] Specific criterion 1
- [ ] Specific criterion 2
- [ ] Specific criterion 3
- [ ] Code tested locally
- [ ] Commit message follows convention
- [ ] PR description complete

## Implementation Notes
- What files to create/modify
- What endpoints to build
- What components to create
- Any gotchas or considerations

## Success Indicators
- [ ] Task can be completed in 1-2 hours
- [ ] Code follows project patterns
- [ ] Tests pass (pytest/npm test)
- [ ] No merge conflicts
- [ ] PR reviewer can understand in 5 minutes

## Testing Strategy
### Backend
```bash
# Test command
pytest production/backend/tests/test_task.py -v
```

### Frontend
```bash
# Test command
npm test -- GuestList.test.tsx
```

### Manual
```bash
# What to verify in browser/curl
curl http://localhost:3001/api/endpoint
```

## Related Tasks
- Previous task: TASK-XXX
- Next task: TASK-XXX
- Blocked by: (if any)

## Files to Create/Modify
- [ ] production/backend/app/api/guests.py
- [ ] production/frontend/src/pages/Guests.tsx
- [ ] production/backend/tests/test_guests.py
- [ ] etc.
```

---

## 🔄 Implementation Loop

### For Each Task, Execute This Loop:

#### STEP 1: READ & UNDERSTAND (5 min)
```
☐ Read task description
☐ Understand acceptance criteria
☐ Note file locations
☐ Identify test strategy
```

#### STEP 2: CREATE BRANCH (1 min)
```bash
git checkout main
git pull origin main
git checkout -b feature/task-name
```

#### STEP 3: IMPLEMENT (45-75 min)
```
☐ Create files
☐ Write code following patterns
☐ Add imports/dependencies
☐ Follow existing code style
☐ Use type hints (Python/TypeScript)
☐ Add docstrings/comments where needed
```

#### STEP 4: TEST LOCALLY (15-30 min)
```bash
# Backend tests
cd production/backend
source venv/bin/activate
pytest tests/ -v

# Frontend tests
cd production/frontend
npm test

# Manual tests (curl/browser)
curl http://localhost:3001/api/endpoint
# Visit http://192.168.0.32:3000 in browser
```

#### STEP 5: VALIDATE CRITERIA (10 min)
```
☐ All acceptance criteria met
☐ Tests pass
☐ Manual verification successful
☐ Code follows patterns
☐ No console errors
☐ Data persists correctly
```

#### STEP 6: COMMIT (5 min)
```bash
git add production/
git commit -m "feat(domain): clear description of what was done"
```

**Commit Message Format:**
```
feat(guests): add create guest endpoint

- Created POST /api/guests endpoint
- Added GuestCreate Pydantic model
- Added tests for endpoint
- Validates email and required fields
```

#### STEP 7: PUSH & CREATE PR (5 min)
```bash
git push -u origin feature/task-name
# Create PR on GitHub with template below
```

#### STEP 8: PR TEMPLATE
```markdown
## Task
Closes #TASK-XXX: [Task Name]

## What This Does
Clear summary of changes.

## Changes Made
- Created file X with Y functionality
- Added endpoint GET /api/endpoint
- Added tests for validation

## Testing Done
- [x] Unit tests pass
- [x] Manual curl tests pass
- [x] Browser verification done
- [x] No console errors

## Files Changed
- production/backend/app/api/guests.py
- production/backend/tests/test_guests.py
- production/frontend/src/pages/Guests.tsx

## Checklist
- [x] Code follows project patterns
- [x] Tests pass (pytest/npm test)
- [x] Commit message follows convention
- [x] PR description complete
- [x] Ready for review

## Notes for Reviewer
Any gotchas or things to pay attention to.
```

#### STEP 9: WAIT FOR REVIEW
```
Human will:
☐ Read code
☐ Check out branch locally
☐ Test manually
☐ Approve or request changes
```

#### STEP 10: RESPOND TO FEEDBACK
```
If changes requested:
☐ Read feedback
☐ Make changes
☐ Commit again
☐ Push
(No need to recreate PR, auto-updates)
```

#### STEP 11: MERGE
```
Human will:
☐ Merge PR to main
☐ Delete feature branch
```

#### STEP 12: UPDATE DOCS
```
After merge:
☐ Update IMPLEMENTATION_LOG.md
☐ Mark task complete
☐ Note any learnings
```

---

## ✅ Validation Checklist

Before pushing PR, verify ALL of these:

### Code Quality
```
☐ Code follows existing patterns
☐ Type hints present (Python/TypeScript)
☐ Docstrings/comments where needed
☐ No console.log/print statements (except logging)
☐ No TODO comments left behind
☐ No hardcoded values
☐ Follows naming conventions
```

### Testing
```
☐ Unit tests exist
☐ Unit tests pass (100%)
☐ Manual tests pass
☐ Edge cases tested
☐ Error handling tested
☐ No test failures
```

### Functionality
```
☐ Feature works as described
☐ All acceptance criteria met
☐ Data persists correctly
☐ Error messages clear
☐ No unexpected side effects
☐ Performance acceptable
```

### Git/PR
```
☐ Branched from main
☐ Commit messages clear
☐ One task per branch
☐ PR description complete
☐ No merge conflicts
☐ Ready for review
```

### Database (if applicable)
```
☐ Schema matches migrations
☐ Foreign keys correct
☐ Indexes appropriate
☐ No N+1 queries
☐ Queries tested
```

### API (if applicable)
```
☐ Endpoint documented
☐ Status codes correct
☐ Error responses consistent
☐ CORS configured
☐ Input validation works
```

### Frontend (if applicable)
```
☐ Component renders
☐ No console errors
☐ Responsive design
☐ Mobile tested
☐ Accessibility considered
```

---

## 📋 Review Process

### What Human Will Check

1. **Code Review**
   - Does it follow patterns?
   - Is it clean and readable?
   - Are there edge cases?
   - Is error handling adequate?

2. **Manual Testing**
   - Can they check out and run it?
   - Does the feature work?
   - Are there bugs?
   - Is performance acceptable?

3. **Integration**
   - Does it break anything else?
   - Are there conflicts?
   - Does it fit the architecture?

4. **Documentation**
   - Is the PR clear?
   - Can someone understand the changes?
   - Are edge cases documented?

### Approval Criteria

PR will be approved when:
```
✅ Code review passed
✅ Manual testing successful
✅ No integration issues
✅ Documentation adequate
✅ All tests pass
```

### Changes Requested

If feedback given:
```
1. Read the feedback carefully
2. Understand what needs to change
3. Make the minimal changes needed
4. Test again
5. Commit: "fix: address review feedback"
6. Push (same branch)
7. Ping human when ready
8. Repeat until approved
```

---

## 📅 Week 1 Task List

### EPIC: Foundation (Week 1)

#### STORY: Database Setup & Backend Models

**TASK-001: Import Database Schema**
- Duration: 30 min
- Difficulty: Easy
- Acceptance Criteria:
  - [x] Schema imported to wedding database
  - [x] All 11 tables created
  - [x] Can query tables successfully
  - [x] Foreign keys intact

**TASK-002: Create Guest SQLAlchemy Model**
- Duration: 45 min
- Difficulty: Easy
- Acceptance Criteria:
  - [x] Guest model created in app/db/models.py
  - [x] All fields mapped correctly
  - [x] Relationships defined
  - [x] Model can be imported and used

**TASK-003: Create Guest CRUD API Endpoints**
- Duration: 90 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] POST /api/guests (create)
  - [x] GET /api/guests (list)
  - [x] GET /api/guests/{id} (detail)
  - [x] PUT /api/guests/{id} (update)
  - [x] DELETE /api/guests/{id} (delete)
  - [x] All endpoints tested with curl
  - [x] Pydantic models for validation
  - [x] Error handling works

**TASK-004: Create Guest CRUD Tests**
- Duration: 60 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] Test POST endpoint
  - [x] Test GET endpoints
  - [x] Test PUT endpoint
  - [x] Test DELETE endpoint
  - [x] Test validation errors
  - [x] All tests pass

#### STORY: Frontend Guest Management

**TASK-005: Create Guest List Component**
- Duration: 60 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] Fetches guests from API
  - [x] Displays in table
  - [x] Shows all fields
  - [x] Handles loading state
  - [x] Handles error state
  - [x] No console errors

**TASK-006: Create Guest Form Component**
- Duration: 75 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] Form inputs for all fields
  - [x] Validates inputs
  - [x] Submits to API
  - [x] Shows success message
  - [x] Shows error message
  - [x] Clears form after submit

**TASK-007: Build Guests Page**
- Duration: 60 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] Displays guest list
  - [x] Shows add guest form
  - [x] Form submits correctly
  - [x] List updates after add
  - [x] Mobile responsive
  - [x] No console errors

**TASK-008: Add Navigation & Integration**
- Duration: 45 min
- Difficulty: Easy
- Acceptance Criteria:
  - [x] React Router configured
  - [x] Navigation menu works
  - [x] Guests page accessible
  - [x] Links functional
  - [x] No 404s

#### STORY: Testing & Quality

**TASK-009: End-to-End Testing**
- Duration: 45 min
- Difficulty: Medium
- Acceptance Criteria:
  - [x] Can add guest via UI
  - [x] Guest appears in list
  - [x] Guest persists in DB
  - [x] Can edit guest
  - [x] Can delete guest
  - [x] All flows tested

**TASK-010: First PR & Code Review**
- Duration: 30 min
- Difficulty: Easy
- Acceptance Criteria:
  - [x] PR created on GitHub
  - [x] All tests passing
  - [x] Manual testing done
  - [x] Ready for human review

---

## 🔧 Development Setup (For Reference)

### Services Running
```
Frontend:  http://192.168.0.32:3000
Backend:   http://192.168.0.32:3001
Database:  192.168.0.32:5432
Swagger:   http://192.168.0.32:3001/docs
```

### Directories
```
~/wedding-dashboard/
├── production/backend/        # FastAPI app
│   ├── app/
│   │   ├── db/
│   │   │   ├── database.py   # DB connection
│   │   │   ├── models.py     # SQLAlchemy models
│   │   │   └── schemas.py    # Pydantic models
│   │   ├── api/
│   │   │   └── guests.py     # Endpoint handlers
│   │   ├── main.py           # App entry point
│   │   └── __init__.py
│   ├── tests/
│   │   └── test_guests.py    # Tests
│   ├── venv/                 # Virtual environment
│   └── requirements.txt
│
├── production/frontend/       # React app
│   ├── src/
│   │   ├── pages/
│   │   │   └── Guests.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── production/database/
    └── schema.sql           # Database schema
```

### Commands Reference

```bash
# Backend
cd production/backend
source venv/bin/activate
pytest tests/ -v
python -m uvicorn app.main:app --reload

# Frontend
cd production/frontend
npm test
npm run dev

# Git
git checkout -b feature/task-name
git add production/
git commit -m "feat(domain): description"
git push -u origin feature/task-name
```

---

## 📊 Progress Tracking

### Track Progress With This Template

Create `IMPLEMENTATION_LOG.md`:

```markdown
# Wedding Dashboard Implementation Log

## Week 1: Foundation

### TASK-001: Import Database Schema
- Status: ✅ COMPLETE
- Date: 2026-06-11
- Time: 30 min
- PR: [Link to PR]
- Notes: Schema imported successfully, 11 tables created

### TASK-002: Create Guest Model
- Status: ✅ COMPLETE
- Date: 2026-06-11
- Time: 45 min
- PR: [Link to PR]
- Notes: Model created with proper relationships

...
```

---

## 🎯 Success Criteria for Week 1

Task is complete when:

```
✅ Database schema imported
✅ All 11 tables created and accessible
✅ Guest model created in SQLAlchemy
✅ CRUD endpoints working (tested with curl)
✅ Guest list page rendering
✅ Add guest form working
✅ Data persists in database
✅ All tests passing
✅ First PR merged to main
✅ Documentation updated
```

---

## 📚 Documentation Requirements

### After Each Task, Update:

1. **IMPLEMENTATION_LOG.md**
   - Task name and status
   - Time taken
   - PR link
   - Key learnings

2. **API_DOCUMENTATION.md** (if API task)
   - New endpoints documented
   - Example requests/responses
   - Error codes

3. **COMPONENT_CATALOG.md** (if frontend task)
   - New components documented
   - Props/interface
   - Usage examples

4. **DATABASE_LOG.md** (if DB task)
   - Schema changes
   - Migrations applied
   - Data model updates

---

## 🚨 Important Reminders for Codex

### DO:
✅ Create one branch per task  
✅ Write descriptive commit messages  
✅ Test before pushing  
✅ Read the task description carefully  
✅ Ask for clarification if unclear  
✅ Validate against acceptance criteria  
✅ Create comprehensive PR descriptions  
✅ Wait for human review before moving on  
✅ Handle feedback professionally  

### DON'T:
❌ Skip testing  
❌ Mix multiple tasks in one branch  
❌ Commit to main directly  
❌ Leave TODOs in code  
❌ Ignore error handling  
❌ Skip documentation  
❌ Force push  
❌ Merge your own PRs  

---

## 💬 Communication Protocol

### When Stuck:
```
1. Re-read the task description
2. Check existing code for patterns
3. Review error messages carefully
4. Look for similar implementations
5. Add a comment to the PR asking for help
6. Wait for human feedback
```

### When Task is Done:
```
1. All tests pass locally
2. Manual testing complete
3. PR created with full description
4. Comment: "Ready for review" on PR
5. Wait for human review
```

### When Feedback Given:
```
1. Read all feedback
2. Understand the requests
3. Make changes
4. Test again
5. Commit with message: "fix: address review feedback"
6. Push to same branch
7. Comment: "Updates complete, ready for re-review"
```

---

## 🎓 Code Patterns to Follow

### Backend Pattern (FastAPI)

```python
# app/api/guests.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Guest
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/guests", tags=["guests"])

class GuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None

class GuestResponse(GuestCreate):
    id: int
    class Config:
        from_attributes = True

@router.post("/", response_model=GuestResponse)
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)):
    db_guest = Guest(**guest.dict())
    db.add(db_guest)
    db.commit()
    db.refresh(db_guest)
    return db_guest

# ... other endpoints following same pattern
```

### Frontend Pattern (React)

```typescript
// src/pages/Guests.tsx
import React, { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'

export function Guests() {
  const { data: guests, loading, error } = useApi('/api/guests')
  const [showForm, setShowForm] = useState(false)

  // Component logic
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### Test Pattern (pytest)

```python
# tests/test_guests.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_guest():
    response = client.post("/api/guests", json={
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
    })
    assert response.status_code == 200
    assert response.json()["first_name"] == "John"
```

---

## 📞 Handoff Instructions

### When Launching Codex Session:

1. **Provide this document**
2. **Provide task list** (see Week 1 Task List)
3. **Provide context:**
   ```
   You are Codex, a development assistant.
   Your job is to:
   - Read small, scoped tasks
   - Implement code following patterns
   - Test locally
   - Create PRs
   - Wait for human review
   
   This guide explains the full process.
   ```

4. **Provide first task:**
   ```
   Start with TASK-001: Import Database Schema
   Follow the Implementation Loop exactly.
   When done, create a PR and wait for review.
   ```

5. **Human monitors and reviews:**
   - Checks out branches
   - Tests manually
   - Reviews code
   - Approves and merges

---

## ✅ Final Checklist Before Codex Starts

```
☐ This guide saved and accessible
☐ Task list prepared (at least Week 1)
☐ GitHub repository accessible
☐ Development environment running
☐ Codex understands workflow
☐ Human ready to review PRs
☐ Git credentials configured in Codex
☐ All documentation linked
```

---

## 📝 Session Structure

Each Codex session should:

```
Session Start
├─ Read task from task list
├─ Understand acceptance criteria
├─ Implement in feature branch
├─ Test locally
├─ Create PR with full description
├─ Wait for human review
│
│  (Human reviews and merges)
│
├─ Update documentation
└─ Move to next task
```

---

## 🎯 Success Definition

**A successful implementation loop looks like:**

```
Monday Morning:
- Codex starts session
- Reads TASK-001
- Implements for 1 hour
- Tests for 30 min
- Creates PR

Monday Afternoon:
- Human reviews PR
- Tests locally
- Approves

Monday Evening:
- Human merges PR
- Codex starts TASK-002
- Repeat

End of Week:
- 10 tasks complete
- Feature-complete guest management
- Ready for next week
```

---

## 📚 Related Documentation

These files provide additional context:

- **IMMEDIATE_ACTION_PLAN.md** - Detailed implementation guide
- **WEDDING_DASHBOARD_ROADMAP.md** - 9-week plan
- **DEBUGGING_METHODOLOGY.md** - Problem-solving approach
- **DEVELOPMENT_ENVIRONMENT_READY.md** - Environment reference

---

## 🚀 You're Ready!

This guide provides everything needed for Codex to:
- ✅ Understand the project
- ✅ Follow the workflow
- ✅ Complete tasks consistently
- ✅ Create quality PRs
- ✅ Collaborate with human
- ✅ Maintain code standards

**Hand this to Codex and start with TASK-001. Good luck! 🎉**

---

**Version:** 1.0  
**Created:** 2026-06-10  
**For:** Codex Local Development Sessions  
**Status:** Ready to Use
