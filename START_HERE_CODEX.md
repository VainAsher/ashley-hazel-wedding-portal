# 🚀 START HERE - Codex Developer Handover

**For:** Claude Code (Codex) Local Session  
**Date:** 2026-06-10  
**Status:** Ready to Begin  

---

## Welcome! 👋

You are Codex, a development assistant. Your job is to build the Wedding Dashboard following a specific workflow. This document gets you started in the next 60 seconds.

---

## The Mission (In 30 Seconds)

Build a **wedding planning and coordination platform** with:
- React frontend (already running at http://192.168.0.32:3000)
- FastAPI backend (already running at http://192.168.0.32:3001)
- PostgreSQL database (ready to use)
- GitHub repository (setup and verified)

**Timeline:** 9 weeks to MVP launch (2026-08-15)  
**This Week:** Complete guest management feature (Tasks 1-10)

---

## Three Documents You MUST Read

1. **CODEX_HANDOVER_GUIDE.md** ← READ FIRST
   - Explains the workflow
   - Shows the testing loop
   - Covers branch strategy
   - Full reference guide

2. **CODEX_TASK_LIST.md** ← YOUR TASK LIST
   - 10 specific tasks for this week
   - Detailed acceptance criteria
   - Code examples provided
   - Testing instructions

3. **DEVELOPMENT_ENVIRONMENT_READY.md** ← QUICK REFERENCE
   - Environment status
   - How to access servers
   - Quick commands
   - Folder structure

---

## Your Workflow (The Loop)

```
1. Read task from CODEX_TASK_LIST.md
   ↓
2. Create feature branch: git checkout -b feature/task-name
   ↓
3. Implement code following patterns
   ↓
4. Test locally (curl, npm test, pytest)
   ↓
5. Validate: "Does it meet acceptance criteria?"
   ↓
6. Commit: git commit -m "feat(domain): description"
   ↓
7. Push: git push -u origin feature/task-name
   ↓
8. Create PR on GitHub with full description
   ↓
9. Wait for human review & approval
   ↓
10. Human merges PR to main
   ↓
11. Move to next task
```

**That's it. Repeat 10 times this week.**

---

## This Week's Mission: 10 Tasks

| # | Task | Est. | Status |
|---|------|------|--------|
| 1 | Import database schema | 30 min | ⏳ Ready |
| 2 | Create Guest model | 45 min | ⏳ Ready |
| 3 | Build CRUD API endpoints | 90 min | ⏳ Ready |
| 4 | Write API tests | 60 min | ⏳ Ready |
| 5 | Build guest list component | 60 min | ⏳ Ready |
| 6 | Build guest form component | 75 min | ⏳ Ready |
| 7 | Create Guests page | 60 min | ⏳ Ready |
| 8 | Setup React Router & nav | 45 min | ⏳ Ready |
| 9 | End-to-end testing | 45 min | ⏳ Ready |
| 10 | Create PR for review | 30 min | ⏳ Ready |
| **TOTAL** | **Complete guest feature** | **~9 hrs** | **⏳ Ready** |

---

## Right Now: Do This

### Step 1: Understand the Workflow (5 min)
Read: **CODEX_HANDOVER_GUIDE.md**
- Sections: Workflow Process, Task Breakdown, Implementation Loop

### Step 2: Get Your Task List (2 min)
Read: **CODEX_TASK_LIST.md**
- Section: TASK-001

### Step 3: Get Reference Info (2 min)
Read: **DEVELOPMENT_ENVIRONMENT_READY.md**
- Everything (it's short)

### Step 4: Start Task 1 (30 min)
Open terminal:
```bash
ssh deploy@192.168.0.32
cd ~/wedding-dashboard
# Follow TASK-001 instructions from CODEX_TASK_LIST.md
```

### Step 5: Create PR (5 min)
When done:
```bash
git checkout -b feature/db-schema-import
git add production/
git commit -m "chore(database): import schema and create all 11 tables"
git push -u origin feature/db-schema-import
```

Then create PR on GitHub with the template from CODEX_HANDOVER_GUIDE.md

### Step 6: Wait for Review
Your human will review, test, and approve. Then move to TASK-002.

---

## Key Rules

### DO ✅
- Read the task description carefully
- Follow the implementation loop exactly
- Test before pushing
- Write clear commit messages
- Create PRs with full descriptions
- Wait for review before moving on
- Ask for clarification if stuck

### DON'T ❌
- Skip testing
- Mix multiple tasks in one branch
- Commit to main directly
- Push without testing
- Ignore acceptance criteria
- Skip documentation
- Create PRs without description

---

## Success Looks Like

```
Monday 10:00 - Start TASK-001
Monday 10:30 - Task 1 complete, PR created
Monday 11:00 - Human reviews PR
Monday 11:30 - PR approved and merged

Monday 12:00 - Start TASK-002
Monday 1:15 - Task 2 complete, PR created
Monday 2:00 - Human reviews and merges

... (repeat 8 more times)

Friday 5:00 - All 10 tasks complete
Friday 6:00 - Complete guest management feature in production
```

---

## If You Get Stuck

**Check in this order:**

1. Reread the task description
2. Look for similar code in repo
3. Check error message carefully
4. Review the patterns section in CODEX_HANDOVER_GUIDE.md
5. Comment on PR: "Need help with X"
6. Wait for human feedback

**Don't:**
- Delete and start over
- Skip to next task
- Ignore errors
- Change the approach without asking

---

## Communication with Your Human

**When PR is ready:**
```
"Task complete. PR created at [URL]. 
Ready for review when you have time."
```

**When feedback received:**
```
"Feedback received. Making changes now."
[Make changes]
"Updates complete. Ready for re-review."
```

**When stuck:**
```
"Need help with X. 
[Explain what you tried and what failed]"
```

---

## Resources Available

**Documentation:**
- CODEX_HANDOVER_GUIDE.md - Full workflow reference
- CODEX_TASK_LIST.md - All 10 tasks with code
- DEVELOPMENT_ENVIRONMENT_READY.md - Environment reference
- WEDDING_DASHBOARD_ROADMAP.md - Big picture (9 weeks)
- DEBUGGING_METHODOLOGY.md - How to troubleshoot

**Environment:**
- Frontend: http://192.168.0.32:3000 ✅ Running
- Backend: http://192.168.0.32:3001 ✅ Running
- Database: 192.168.0.32:5432 ✅ Running
- Swagger: http://192.168.0.32:3001/docs ✅ Available

**Code:**
- Backend: ~/wedding-dashboard/production/backend
- Frontend: ~/wedding-dashboard/production/frontend
- Database: ~/wedding-dashboard/production/database

---

## Quick Commands Reference

```bash
# SSH to VM
ssh deploy@192.168.0.32

# Create branch
git checkout main
git pull origin main
git checkout -b feature/task-name

# Test backend
cd production/backend
source venv/bin/activate
pytest tests/ -v

# Test frontend
cd production/frontend
npm test

# Manual API test
curl http://localhost:3001/api/guests

# Commit
git add production/
git commit -m "feat(domain): description"
git push -u origin feature/task-name
```

---

## The Human Will Do

- Review your code
- Test locally
- Approve PRs
- Merge to main
- Provide feedback
- Unblock you if stuck

You don't need to wait for them to test before pushing - they'll review async. But they'll give feedback before approving.

---

## Success Metrics

By end of week:

```
✅ Database schema imported
✅ Guest CRUD API complete
✅ Guest UI complete
✅ All tests passing
✅ 10 PRs merged to main
✅ Feature-complete guest management
✅ Ready for next week's tasks
```

---

## Your First Task Right Now

### TASK-001: Import Database Schema (30 min)

**Description:** Import PostgreSQL schema to create all 11 tables

**How to start:**
1. Open CODEX_TASK_LIST.md
2. Go to "TASK-001: Import Database Schema"
3. Follow the instructions exactly
4. When done, create PR

**Expected time:** 30 minutes  
**When done:** Create PR and wait for review

---

## Questions Before You Start?

**Common Q&A:**

Q: "What if I make a mistake?"
A: You're in a git branch. You can rebase or just fix in the next commit.

Q: "What if I can't test something?"
A: Tell the human in the PR description. They'll help.

Q: "How long should I work before creating a PR?"
A: One task = one PR. Create PR when task is complete.

Q: "What if the human rejects the PR?"
A: They'll leave comments. Make changes, commit, push to same branch.

Q: "Should I work on multiple tasks?"
A: No. One task at a time. Complete, PR, merge, then next.

---

## Let's Go! 🚀

1. **Read CODEX_HANDOVER_GUIDE.md** (10 min)
2. **Read CODEX_TASK_LIST.md** (5 min)
3. **Start TASK-001** (30 min)
4. **Create PR** (5 min)
5. **Wait for review**

**Total to first PR: ~50 minutes**

---

## Remember

You're not alone. Your human is:
- Reviewing your work
- Available if you get stuck
- Merging your PRs
- Approving your progress

Together you'll build an amazing wedding dashboard.

**Let's ship it! 🎉**

---

**Next Step:** Read CODEX_HANDOVER_GUIDE.md sections on:
1. Workflow Process
2. Task Breakdown System
3. Implementation Loop

Then start TASK-001.

**You've got this! 💪**

