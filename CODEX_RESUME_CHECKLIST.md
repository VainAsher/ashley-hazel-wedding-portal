# Codex Resume Checklist - Ready for Next Task

**When to use:** After Codex merges current task, before starting next task  
**Status:** Everything integrated and ready  
**Date:** 2026-06-11

---

## ✅ Codex: Here's What You Need to Know

### **New Feature This Week: Ollama Feedback Loop**

We added **local code feedback** to help you develop faster. It's completely optional.

**TL;DR:**
- Before you commit: Ollama checks your code (lint)
- After you run tests: Ollama extracts test results
- Both are optional—you can skip if you prefer
- It's free, fast, local, and safe

**Where:** `WEEK_2_OLLAMA_QUICK_START.md` (just read this, takes 2 minutes)

### **Your Workflow (Unchanged)**

Still the same as Week 1:
1. Read task from WEEK_2_TASK_LIST.md
2. Create branch: `git checkout -b week2/task-XXX-name`
3. Implement code
4. **[NEW, optional] Ollama gives feedback before commit**
5. Run tests
6. **[NEW, optional] Test summary auto-extracted**
7. Create PR
8. Wait for review
9. Merge
10. Repeat

The new optional steps don't change anything if you skip them.

### **Documents Updated**

- ✅ WEEK_2_START_HERE.md — Added Ollama quick start
- ✅ WEEK_2_HANDOVER_GUIDE.md — Added Ollama section (Section 8)
- ✅ WEEK_2_TASK_CONTINUATION.md — Created (you're reading related to this)

### **New Documents for Reference**

If you want details:
- `WEEK_2_OLLAMA_QUICK_START.md` — Simple guide (READ THIS FIRST)
- `WEEK_2_OLLAMA_INTEGRATION.md` — Context & rationale
- `OLLAMA_TIER1_IMPLEMENTATION.md` — Technical deep-dive (optional)

### **Nothing Changed for You**

- ✅ Your tasks are the same
- ✅ Task list is the same
- ✅ Acceptance criteria unchanged
- ✅ Testing approach unchanged
- ✅ Just more optional feedback available

---

## 🎯 When You Merge Your Current Task

1. Merge PR (normal process)
2. **READ:** `WEEK_2_OLLAMA_QUICK_START.md` (2 minutes)
3. Start next task in WEEK_2_TASK_LIST.md (normal process)
4. Use Ollama feedback if it helps (optional)

---

## 📋 Your Current Status

**Completed:**
- TASK-001: CORS security ✅
- TASK-002: Environment variables ✅
- TASK-003: Secrets management ✅
- TASK-004: Database indexes ✅

**Next (when ready):**
- TASK-005: Database triggers & audit
- TASK-006: Database constraints & integrity
- TASK-007+: CI/CD pipeline, testing, monitoring

---

## 💡 Questions?

- **How do I use Ollama?** → Read `WEEK_2_OLLAMA_QUICK_START.md`
- **Do I have to use it?** → No, it's optional
- **What if it breaks?** → It will just skip, no problem
- **What's it measuring?** → Whether it saves token costs (phase 0 measurement)

---

## ✨ Summary

**New thing:** Ollama feedback (optional lint + test summary)  
**Your effort:** Same as before  
**Your benefit:** Faster feedback loop if you use it  
**Risk:** None (fully optional, all fallbacks in place)  
**Status:** Ready to go

Pull latest main, read the quick start, continue with TASK-005.

Let's ship! 🚀
