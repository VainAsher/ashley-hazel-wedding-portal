# Authentication Fixtures Documentation Index

Welcome to the authentication fixtures for the wedding portal Playwright tests. This directory contains reusable test utilities that eliminate authentication boilerplate and provide consistent patterns across all tests.

## 📚 Documentation Files

### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) ⭐ **START HERE**
- 5-minute introduction
- Copy-paste ready code templates
- Common patterns at a glance
- Common errors & fixes
- **Best for:** Getting started quickly

### [README.md](./README.md) 📖
- Comprehensive fixture documentation
- All available fixtures explained
- Complete API reference
- Troubleshooting guide
- **Best for:** Understanding all features

### [SETUP_GUIDE.md](./SETUP_GUIDE.md) ⚙️
- Installation instructions
- Project structure setup
- Optional enhancements (custom fixtures, global setup)
- Performance optimization
- CI/CD integration
- **Best for:** Integration and advanced setup

### [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) 🔄
- How to refactor existing tests
- Before/after examples
- Line reduction statistics
- Migration checklist
- Rollback plan
- **Best for:** Converting old tests to use fixtures

### [INDEX.md](./INDEX.md) 📑
- This file
- Navigation guide
- File descriptions

## 🔧 Implementation Files

### [auth.fixture.ts](./auth.fixture.ts) 🎯 **MAIN FIXTURE**
- Core fixture implementation (~260 lines)
- Pre-configured fixtures for different user roles
- Utility functions for authentication
- Error tracking helpers
- Test user definitions
- **What to do:** Import `authenticatedTest` in your tests

### [auth.fixture.example.ts](./auth.fixture.example.ts) 💡
- 10 comprehensive usage examples
- Different patterns for different scenarios
- Real-world test cases
- Integration examples
- **What to do:** Reference for test patterns

## 🚀 Quick Start

### 1. Copy the Fixture
```bash
# Already in place at:
# production/frontend/tests/browser/fixtures/auth.fixture.ts
```

### 2. Import in Your Tests
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('my test', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```

### 3. Run Tests
```bash
npm run test:browser
```

## 📖 Reading Guide by Task

### "I need to write a new test"
1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - 5 min
2. Pick the right fixture pattern
3. Copy-paste template
4. Write assertions

### "I need to understand all the features"
1. Read [README.md](./README.md) - 20 min
2. Check [auth.fixture.example.ts](./auth.fixture.example.ts) for patterns
3. Reference as needed

### "I need to convert existing tests"
1. Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 15 min
2. Follow checklist for each test
3. Run tests to verify

### "I need to customize for my project"
1. Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 20 min
2. Optional section on custom fixtures
3. Create your extension

### "I'm having trouble"
1. Check [README.md](./README.md) → Troubleshooting section
2. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) → Common Errors & Fixes
3. Reference [auth.fixture.example.ts](./auth.fixture.example.ts) → Pattern examples

## 🎯 By Use Case

### Testing Protected Routes
```typescript
// See: QUICK_REFERENCE.md - Pattern: Test Protected Route
authenticatedTest('admin accessible', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```
Files: All documentation files have examples

### Testing Role-Based Access Control
```typescript
// See: QUICK_REFERENCE.md - Pattern: Test Access Denied
authenticatedTest('guest denied', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/admin')
  await expect(authenticatedGuestPage).toHaveURL(/\/rsvp$/)
})
```
Files: auth.fixture.example.ts (Pattern 2, 8)

### Testing Login Flow
```typescript
// See: QUICK_REFERENCE.md - Pattern: Test Login Form
testWithAuth('login', async ({ page }) => {
  await authenticateWithInviteCode(page, 'CODE', testUsers.guest)
})
```
Files: auth.fixture.example.ts (Pattern 6, 10)

### Custom Mocks & Setup
```typescript
// See: SETUP_GUIDE.md - Custom Fixture Extensions
// See: auth.fixture.example.ts (Pattern 4)
```

### Real Backend Testing
```typescript
// See: auth.fixture.example.ts - Pattern 6
// See: SETUP_GUIDE.md - Environment Variables
authenticateWithInviteCode(page, 'CODE', user, { mockApi: false })
```

## 📊 File Statistics

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| auth.fixture.ts | 6.1K | 260 | Core fixture implementation |
| auth.fixture.example.ts | 6.5K | 300 | Usage examples |
| README.md | 8.8K | 350 | Complete documentation |
| QUICK_REFERENCE.md | 9.1K | 380 | Quick reference & templates |
| MIGRATION_GUIDE.md | 13K | 500 | Migration & refactoring guide |
| SETUP_GUIDE.md | 12K | 450 | Setup & integration guide |
| **Total** | **54.5K** | **2,240** | **Complete fixture package** |

## 🔑 Key Concepts

### Pre-Authenticated Fixtures
Pre-configured pages with user already logged in. Use when you just need to test authenticated routes:
- `authenticatedCouplePage` - Admin/couple user
- `authenticatedGuestPage` - Guest user
- `authenticatedCoordinatorPage` - Coordinator user

**When to use:** 80% of tests
**Example:** Testing protected routes, UI rendering, RBAC

### Manual Authentication
Full control over auth setup. Use when testing login flow or complex scenarios:
- `testWithAuth` - Base fixture with error tracking
- `authenticateWithInviteCode()` - Full login flow
- `preAuthenticateUser()` - Fast pre-auth without UI

**When to use:** Custom setups, login flows, multiple users per test
**Example:** Testing login form, session persistence, auth errors

### Error Tracking
Built-in console/page error monitoring. Automatically ignores expected errors (401s, network errors).

**When to use:** Always (automatic in fixtures)
**Example:** Catching unexpected JavaScript errors

## 🎓 Learning Path

### Level 1: Complete Beginner (10 minutes)
1. Read QUICK_REFERENCE.md top section
2. Copy-paste first template
3. Write simple test
4. `npm run test:browser`

### Level 2: Comfortable (30 minutes)
1. Read README.md sections 1-3
2. Try 2-3 different fixture patterns
3. Reference auth.fixture.example.ts
4. Start migrating one existing test

### Level 3: Proficient (1 hour)
1. Read all documentation
2. Review auth.fixture.ts implementation
3. Create custom fixtures for your domain
4. Migrate all tests using checklist

### Level 4: Expert (2+ hours)
1. Review all example patterns
2. Implement global setup if needed
3. Create centralized test data
4. Optimize CI/CD integration

## ✅ Checklist: Getting Started

- [ ] Copy `auth.fixture.ts` to `tests/browser/fixtures/`
- [ ] Read QUICK_REFERENCE.md (5 min)
- [ ] Write one test using `authenticatedTest`
- [ ] Run `npm run test:browser`
- [ ] Test passes ✓
- [ ] Share link to QUICK_REFERENCE.md with team
- [ ] Plan migration of existing tests (MIGRATION_GUIDE.md)
- [ ] Optional: Implement custom fixtures (SETUP_GUIDE.md)

## 🤝 Using with Your Team

### Share These Files
- `QUICK_REFERENCE.md` - Everyone writing tests
- `README.md` - Complete reference
- `auth.fixture.ts` - The fixture itself

### Keep These Internal
- `MIGRATION_GUIDE.md` - When refactoring tests
- `SETUP_GUIDE.md` - When customizing
- `auth.fixture.example.ts` - Reference examples

### Create Project Docs
Document in your project's main README:
```markdown
## Running Tests

Tests use Playwright with authentication fixtures:

1. See `tests/browser/fixtures/QUICK_REFERENCE.md` to write tests
2. See `tests/browser/fixtures/README.md` for full documentation
3. Run: `npm run test:browser`
```

## 🐛 Debug Checklist

If tests fail:

1. **Tests won't authenticate** → Check QUICK_REFERENCE.md "Common Errors"
2. **Import errors** → Verify path is `./fixtures/auth.fixture`
3. **Type errors** → Check README.md "Advanced" section
4. **Behavior unexpected** → See auth.fixture.example.ts for pattern
5. **Need real backend** → See SETUP_GUIDE.md "Environment Variables"

## 📞 Quick Help

### "How do I...?"

- ...test a protected admin route? → QUICK_REFERENCE.md: Pattern: Test Protected Route
- ...test login? → auth.fixture.example.ts: Pattern 6
- ...create custom fixtures? → SETUP_GUIDE.md: Optional: Custom Fixture Extensions
- ...migrate my tests? → MIGRATION_GUIDE.md: Migration Strategy
- ...debug errors? → README.md: Troubleshooting
- ...use real backend? → SETUP_GUIDE.md: Environment Variables

### "What is...?"

- ...the difference between fixtures? → README.md: Available Fixtures
- ...error tracking? → QUICK_REFERENCE.md: Error Tracking
- ...session persistence? → auth.fixture.example.ts: Pattern 9

## 🎯 Next Steps

1. **For your next test:** Copy template from QUICK_REFERENCE.md
2. **To migrate tests:** Follow MIGRATION_GUIDE.md checklist
3. **For advanced setup:** Implement optional features in SETUP_GUIDE.md
4. **For team:** Share QUICK_REFERENCE.md + README.md

## 📝 Summary

| Document | Read Time | Best For |
|----------|-----------|----------|
| QUICK_REFERENCE.md | 5 min | Writing tests |
| README.md | 20 min | Understanding features |
| auth.fixture.example.ts | 15 min | Learning patterns |
| MIGRATION_GUIDE.md | 15 min | Refactoring tests |
| SETUP_GUIDE.md | 20 min | Advanced setup |
| auth.fixture.ts | 15 min | Understanding implementation |

---

**Ready to get started?** → Open [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

**Want comprehensive docs?** → Open [README.md](./README.md)

**Need to refactor tests?** → Open [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

**Customizing for your project?** → Open [SETUP_GUIDE.md](./SETUP_GUIDE.md)
