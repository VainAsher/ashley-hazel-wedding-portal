# Ashley & Hazel Wedding Portal — Monorepo Guide

**Repository:** `https://github.com/VainAsher/ashley-hazel-wedding-portal`

This is a **monorepo** containing both the prototype (UI/UX design) and the production (full-stack app) in a single GitHub repository.

---

## Repository Structure

```
ashley-hazel-wedding-portal/
│
├── prototype/                    ← Prototype track (existing)
│   ├── index.html               │ Static HTML/CSS/JS
│   ├── styles.css               │ UI/UX design
│   ├── app.js                   │ Clickable prototype
│   ├── data/                    │ Sample data
│   └── docs/                    │ Design documentation
│
├── production/                   ← Production track (new)
│   ├── backend/                 │ FastAPI (Python)
│   │   ├── app/
│   │   ├── tests/
│   │   └── requirements.txt
│   ├── frontend/                │ React (TypeScript)
│   │   ├── src/
│   │   └── package.json
│   ├── database/                │ PostgreSQL schema & migrations
│   │   ├── schema.sql
│   │   └── migrations/
│   ├── docker-compose.yml
│   └── README.md
│
├── docs/                         ← Shared documentation
│   ├── ARCHITECTURE.md
│   ├── PRODUCTION_SETUP.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   └── PROTOTYPE.md
│
├── .env.example                  ← Development template
├── .env.production               ← Production environment (on VM)
├── .gitignore                    ← Python + Node.js + secrets
├── README.md                     ← Root README (this file)
└── DEPLOYMENT.md                 ← Production deployment guide
```

---

## Branches Strategy

### Main Branches

- **`main`** — Stable, production-ready code
  - Both prototype and production code
  - Protected: requires PR reviews
  - Releases tagged (v1.0.0, etc.)

- **`develop`** — Integration branch for features
  - Combines all feature work
  - Used for testing before main merge
  - Can be deployed to staging

### Feature Branches

```
feature/prototype-new-card       ← Prototype UI updates
feature/guests-import            ← Production feature
feature/budget-filters           ← Production feature

bugfix/prototype-styling         ← Prototype fixes
bugfix/rsvp-calculation          ← Production fixes

docs/architecture-update         ← Documentation
docs/setup-guide                 ← Documentation
```

**Naming Convention:**
- `feature/<scope>-<description>`
- `bugfix/<scope>-<description>`
- `docs/<description>`
- `chore/<description>` — Dependencies, config

---

## Development Workflows

### Prototype Development

**Local work (on your machine):**

```bash
# Clone the repo
git clone https://github.com/VainAsher/ashley-hazel-wedding-portal.git
cd ashley-hazel-wedding-portal

# Create feature branch
git checkout -b feature/prototype-guest-cards

# Edit prototype files
# - Modify /prototype/index.html
# - Update /prototype/styles.css
# - Test by opening index.html in browser

# Commit changes
git add prototype/styles.css prototype/index.html
git commit -m "feat(prototype): add guest card component with hover effects"

# Push to GitHub
git push -u origin feature/prototype-guest-cards

# Create Pull Request on GitHub
# → Review and test
# → Merge to main
```

---

### Production Development

**On wedding-db VM (192.168.0.32):**

```bash
# SSH to dev VM
ssh deploy@192.168.0.32

# Navigate to repo
cd ~/wedding-dashboard

# Verify location
pwd  # Should be: /home/deploy/wedding-dashboard
ls   # Should see: prototype/, production/, docs/, etc.

# Create feature branch
git checkout -b feature/guests-import

# Develop in /production folder
cd production/backend
# Edit app code, create API endpoints, etc.

cd ../frontend
# Edit React components, styles, etc.

cd ../database
# Create migrations for schema changes
cat > migrations/002_add_guest_status.sql << 'EOF'
ALTER TABLE guests ADD COLUMN status VARCHAR(50);
EOF

# Commit from root of monorepo
cd ~/wedding-dashboard

git add production/backend/app/api/guests.py
git add production/frontend/src/pages/Guests.tsx
git add production/database/migrations/002_add_guest_status.sql

git commit -m "feat(guests): add import from CSV with status tracking"

# Push to GitHub
git push -u origin feature/guests-import

# Create Pull Request on GitHub for review
```

---

## Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code restructuring (no new features)
- `test` — Adding/updating tests
- `chore` — Dependencies, config, maintenance

### Scopes

**Prototype:**
- `prototype` — General prototype updates
- `prototype-ui` — Visual/CSS changes
- `prototype-layout` — Structure changes

**Production:**
- `guests` — Guest management features
- `budget` — Budget tracking features
- `vendors` — Vendor management
- `tasks` — Task/coordination features
- `events` — Timeline/events
- `db` — Database schema/migrations
- `api` — API endpoints
- `auth` — Authentication
- `ui` — Frontend components

### Examples

```
feat(prototype): add RSVP response animation

feat(guests): add CSV import with validation
Implements bulk guest import from Google Sheets export.
Validates email format and phone numbers.
Shows import progress with error reporting.

fix(budget): correct tax calculation for catering
Multiplies subtotal by tax rate, not total.

docs(production): add API authentication guide

chore(deps): update React to 18.3.0
```

---

## File Changes by Component

### When to Edit What

**Prototype Changes:**
```
Modify:  /prototype/index.html
         /prototype/styles.css
         /prototype/app.js
         /prototype/data/

Commit with: "feat(prototype): ..."
Branch: feature/prototype-*
Deploy: Push to main
```

**Production Backend Changes:**
```
Modify:  /production/backend/app/**
         /production/backend/requirements.txt
         /production/backend/tests/

Commit with: "feat(guests|budget|...): ..."
Branch: feature/production-*
Deploy: After merge to main, redeploy to VM
```

**Production Frontend Changes:**
```
Modify:  /production/frontend/src/**
         /production/frontend/package.json
         /production/frontend/tsconfig.json

Commit with: "feat(guests|budget|...): ..."
Branch: feature/production-*
Deploy: After merge to main, rebuild on VM
```

**Database Changes:**
```
Modify:  /production/database/schema.sql
         /production/database/migrations/*.sql

Create new migration:
  cat > /production/database/migrations/NNN_description.sql
  Apply to dev: psql -h localhost -U wedding_dev -d wedding -f NNN_description.sql

Commit with: "chore(db): ..."
Branch: feature/* (same as backend feature)
Deploy: Run migrations on production VM before deploy
```

**Documentation Changes:**
```
Modify:  /docs/**
         /README.md
         Any *.md file

Commit with: "docs(scope): ..."
Branch: docs/description
Deploy: Push to main immediately (low risk)
```

---

## Pull Request Workflow

### Creating a PR

1. **Push feature branch to GitHub**
   ```bash
   git push -u origin feature/my-feature
   ```

2. **Create PR on GitHub**
   - Title: Clear, concise description
   - Body: Reference issue, describe changes, testing notes
   - Link issue (if applicable): "Fixes #123"

3. **Example PR Description:**
   ```
   ## Description
   Add ability to import guests from CSV exported from Google Sheets.
   
   ## Changes
   - New endpoint: POST /api/guests/import-csv
   - New component: GuestImportDialog
   - Migration: Add status field to guests table
   
   ## Testing
   - ✅ Tested with sample CSV file
   - ✅ Validates email format
   - ✅ Shows error for duplicates
   - ✅ Displays progress
   
   ## Files Changed
   - production/backend/app/api/guests.py
   - production/frontend/src/pages/Guests.tsx
   - production/database/migrations/002_*.sql
   ```

### Reviewing a PR

**If you're reviewing:**
1. Check code quality and logic
2. Verify commits follow convention
3. Test functionality if possible
4. Request changes or approve

**If your PR is being reviewed:**
1. Address comments promptly
2. Push new commits (don't force-push)
3. Request review again when ready
4. Be responsive to feedback

### Merging a PR

1. **Ensure all checks pass**
   - Tests must pass
   - No conflicts with main
   - Commits are clean

2. **Merge strategy:**
   - Use "Squash and merge" for small fixes
   - Use "Create a merge commit" for features
   - NEVER force-push to main

3. **After merge:**
   - Delete feature branch
   - Pull latest main locally
   - Deploy changes (if applicable)

---

## Common Commands

### Local Development (Prototype)

```bash
# Clone
git clone https://github.com/VainAsher/ashley-hazel-wedding-portal.git
cd ashley-hazel-wedding-portal

# Create branch
git checkout -b feature/prototype-cards

# Stage changes
git add prototype/styles.css

# Commit
git commit -m "feat(prototype): add card component"

# Push
git push -u origin feature/prototype-cards

# Switch branches
git checkout main
git checkout develop

# Pull latest
git pull origin main

# View history
git log --oneline -10
```

### Wedding-db VM Development (Production)

```bash
# SSH to VM
ssh deploy@192.168.0.32
cd ~/wedding-dashboard

# Create branch
git checkout -b feature/guests-import

# Edit files in production/
cd production/backend
nano app/api/guests.py

# Commit from repo root
cd ~/wedding-dashboard
git add production/backend/app/api/guests.py
git commit -m "feat(guests): add import endpoint"

# Push
git push -u origin feature/guests-import

# View changes
git status
git diff production/backend/app/api/guests.py

# View commits
git log --oneline

# Switch branches
git checkout develop
git checkout main

# Merge after PR approval
git checkout main
git merge feature/guests-import
git push origin main
```

---

## Monorepo Best Practices

✅ **DO:**
- Keep commits focused and atomic
- Write clear, descriptive commit messages
- Test changes before pushing
- Review others' code in PRs
- Update documentation with code changes
- Use feature branches for all work

❌ **DON'T:**
- Commit both prototype and production changes together (use separate commits)
- Force-push to main or develop
- Merge without PR review
- Skip testing before merge
- Break backward compatibility without discussion
- Commit .env or secrets files

---

## Issue Tracking

When creating issues, include:

```markdown
## Description
Clear explanation of the issue or feature

## Type
- [ ] Bug
- [ ] Feature
- [ ] Enhancement

## Scope
- [ ] Prototype
- [ ] Production (backend)
- [ ] Production (frontend)
- [ ] Database
- [ ] Documentation

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Resources
- Links to related issues
- Design mockups
- Database schema changes
```

---

## Deployment Workflow

### Prototype Updates
```
1. Create feature branch
2. Update /prototype files
3. Test in browser
4. Create PR
5. Merge to main
6. Changes live immediately (static files)
```

### Production Updates
```
1. Create feature branch
2. Develop in /production
3. Test on wedding-db VM
4. Create PR
5. Code review + approval
6. Merge to main
7. Deploy to production VM (TBD - not yet active)
```

---

## Quick Links

- **GitHub:** https://github.com/VainAsher/ashley-hazel-wedding-portal
- **Dev VM:** ssh deploy@192.168.0.32
- **Prototype:** Open /prototype/index.html in browser
- **Production Docs:** /docs/PRODUCTION_SETUP.md
- **Architecture:** /docs/ARCHITECTURE.md

---

## Support

For issues with:
- **Prototype:** Check /prototype/README.md
- **Production:** Check /production/README.md
- **Architecture:** Check /docs/ARCHITECTURE.md
- **Git workflow:** Check this guide

---

**This monorepo structure keeps both the design and production code together while maintaining clear separation of concerns.**
