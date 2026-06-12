# Week 2 Ollama Quick Start for Codex

**TL;DR:** Ollama gives you instant code feedback before you push. Completely optional. If it helps, great. If not, no problem.

---

## ⚡ 30-Second Version

```
1. You write code normally
2. Before you commit, run: ollama lint check
   Result: "0 issues found" or "Found console.log on line 45"
3. Fix any issues if you agree with them
4. Commit
5. Run tests
6. Test results automatically added to PR
7. Push & create PR normally
```

Done. That's it.

---

## 📍 What Ollama Checks

### **Lint (Before Commit)**
- console.log, console.warn, console.error
- Unused imports
- // TODO comments
- debugger statements
- Hardcoded secrets (passwords, API keys)

### **Test Summary (After Tests)**
- Passed count
- Failed count
- Skipped count
- Duration

---

## 🚀 Step-by-Step (Week 2)

### **Step 1: Start Week 2 Normally**

Read the handover as usual:
1. WEEK_2_START_HERE.md
2. WEEK_2_HANDOVER_GUIDE.md
3. WEEK_2_TASK_LIST.md

### **Step 2: NEW - Read Ollama Guide**

- **Quick version:** WEEK_2_OLLAMA_INTEGRATION.md (this context section)
- **Technical details:** OLLAMA_TIER1_IMPLEMENTATION.md (if you care how it works)

### **Step 3: Start Tasks Normally**

Nothing changes. Write code like always.

### **Step 4: Before Each Commit**

Option A (Recommended - Lint Check):
```bash
# Run Ollama lint check on your code
cd production/backend
python scripts/ollama_lint.py --check app/api/guests.py --language python

# Or for JavaScript:
python scripts/ollama_lint.py --check ../frontend/src/App.tsx --language javascript

# You see results like:
# ⚠️  Lint Issues (1 found):
# ⚠️  [console_log] Line 45: console.log('debug info')

# Fix any if you agree, then commit normally
git commit
```

Option B (Using Bash Wrapper - Simpler):
```bash
cd production/backend
./scripts/ollama_lint.sh app/api/guests.py python

# Same output, shorter command
```

Option C (Skip):
```bash
# Don't use Ollama, just commit normally
git commit
```

**All options are fine.** Use whichever you prefer.

See `production/backend/scripts/OLLAMA_HELPERS.md` for full command reference.

### **Step 5: After Tests**

Ollama test summary is extracted and added to PR description.

You'll see:
```
### Test Results
✅ 12 passed, 0 failed, 1.23s
```

If extraction fails, raw output is shown instead. No problem either way.

### **Step 6: Push & PR**

Same as always. Create PR on GitHub.

---

## 📊 Tracking (Super Simple)

During Week 2, just keep quick notes:

```
Task 001: Lint found console.log, fixed it. Tests: 12 passed.
Task 002: Ollama timed out, skipped lint. Tests: 8 passed, 1 failed (fixed).
Task 003: Lint found TODO, didn't fix (intentional). Tests: 10 passed.
...
```

That's enough. We just want to know:
- Does Ollama's feedback usually correct?
- Does test extraction work?
- Any problems?

See OLLAMA_PHASE0_TRACKING.md for detailed template if you want.

---

## ❓ Quick FAQs

**Q: What if Ollama finds something I don't agree with?**  
A: Ignore it. Just commit. Human review catches anything important.

**Q: What if Ollama times out?**  
A: Check is skipped, you proceed normally. No impact.

**Q: What if test summary is wrong?**  
A: Raw test output is always in the PR. Human sees real results.

**Q: Do I have to use it?**  
A: Nope. Completely optional. Skip it if you prefer.

**Q: Will this slow me down?**  
A: No. Ollama runs locally (<1 second). If anything, it speeds you up.

**Q: What if something breaks?**  
A: Just skip Ollama for that task. It's completely safe.

---

## 🎯 Success Looks Like

```
Week 2 with Ollama:
├─ Lint check usually catches real issues ✅
├─ Test summary extracts correctly ✅
├─ Takes <1 second per check ✅
├─ Doesn't disrupt workflow ✅
└─ Saves time on code review prep ✅

Week 2 without Ollama (if you skip it):
└─ Everything works exactly the same ✅
```

Either way, you're good.

---

## 🔍 What Gets Measured

We're measuring 3 things:

1. **Does Ollama help?** (Find real issues, few false alarms)
2. **Is it fast enough?** (Respond in <1 second)
3. **Does it save credits?** (Reduce Codex API calls by 20-30%)

At end of Week 2, we decide:
- Keep Tier 1 for Week 3? (Lint + test summary)
- Expand to Tier 2? (More complex validation)
- Disable it? (Not working)

---

## 📚 References

- **How it works:** OLLAMA_TIER1_IMPLEMENTATION.md
- **Tracking template:** OLLAMA_PHASE0_TRACKING.md
- **Full explanation:** WEEK_2_OLLAMA_INTEGRATION.md

But honestly? You don't need to read those. Just use it like above.

---

## ✅ You're Ready

That's everything you need to know.

**TL;DR of TL;DR:**
1. Write code normally
2. Ollama gives feedback before commit
3. Fix if you agree
4. Commit & push
5. That's it

Questions? Ask during Week 2 and we'll adjust.

Let's go! 🚀
