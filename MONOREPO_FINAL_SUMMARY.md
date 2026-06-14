# Wedding Dashboard - Monorepo Architecture (Final)

**Date:** 2026-06-10  
**Structure:** Single Monorepo  
**Repository:** https://github.com/VainAsher/ashley-hazel-wedding-portal

---

## Architecture Decision

✅ **APPROVED:** Keep existing `ashley-hazel-wedding-portal` repo and add `/production` folder

This consolidates both the prototype and production code in a single GitHub repository.

---

## Repository Structure

```
ashley-hazel-wedding-portal/

├── prototype/                    ← UI/UX Design (Existing)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data/
│   ├── docs/
│   └── ... (existing files)
│
├── production/                   ← Full-Stack App (New)
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── db/
│   │   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   └── schemas.py
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── styles/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── README.md
│   │
│   ├── database/
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   │   ├── 001_init_schema.sql
│   │   │   ├── 002_*.sql
│   │   │   └── README.md
│   │   └── seeds/
│   │
│   ├── docker-compose.yml
│   └── README.md
│
├── docs/                         ← Shared Documentation
│   ├── ARCHITECTURE.md
│   ├── PRODUCTION_SETUP.md
│   ├── PRODUCTION_DATABASE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   └── PROTOTYPE.md
│
├── .env.example
├── .env.production               ← On wedding-db VM only
├── .gitignore                    ← Updated with Python + Node.js
├── README.md                     ← Root README
├── MONOREPO_GUIDE.md            ← This repo's git workflow
├── LICENSE
└── DEPLOYMENT.md
```

---

## Key Benefits

✅ **Single Source of Truth**
- Both prototype and production in one GitHub repo
- Easier to track all wedding-related work
- Coordinated releases and versions

✅ **Clear Separation**
- `/prototype` — Keep designer's work separate
- `/production` — Keep developer's work separate
- Developers can work without affecting design

✅ **Shared Documentation**
- `/docs` — Single place for all docs
- No duplication across repos
- Easier to keep in sync

✅ **Unified Git Workflow**
- Single branch strategy
- Single PR process
- Single version/release tagging

✅ **Compound Benefits**
- If other teams need event-planner, they use `/production` as template
- Prototype serves as design reference for other projects
- Component library can reference both tracks

---

## Development Locations

### Prototype Development
- **Location:** Your machine (local)
- **Files:** `/prototype/` folder
- **Push to:** `https://github.com/VainAsher/ashley-hazel-wedding-portal`
- **Branch:** `feature/prototype-*`
- **Commits:** `feat(prototype): ...`

### Production Development
- **Location:** wedding-db VM (192.168.0.32)
- **Clone path:** `~/wedding-dashboard/`
- **Files:** `/production/` folder
- **Push to:** `https://github.com/VainAsher/ashley-hazel-wedding-portal`
- **Branch:** `feature/*`, `bugfix/*`, `docs/*`
- **Commits:** `feat(guests):`, `feat(budget):`, `chore(db):`, etc.

---

## Immediate Next Steps

### 1. Add SSH Deploy Key (5 min)
```
Go to: https://github.com/VainAsher/ashley-hazel-wedding-portal/settings/keys
Add key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII2b+tsJfhvfTSapEPeqT5uECxSg4Q0m5iRu8kkAe0tY wedding-dev@192.168.0.32
```

### 2. Clone Repo on wedding-db VM (5 min)
```bash
ssh deploy@192.168.0.32
git clone https://github.com/VainAsher/ashley-hazel-wedding-portal.git ~/wedding-dashboard
cd ~/wedding-dashboard
ls  # Verify: prototype/ and other existing files
```

### 3. Create Production Folder (10 min)
```bash
cd ~/wedding-dashboard
mkdir -p production/{backend/app/{api,db,core},frontend/src/{components,pages,hooks,styles},database/migrations}
# Create initial files (see NEXT_STEPS.md for details)
```

### 4. First Commit (5 min)
```bash
cd ~/wedding-dashboard
git add production/
git commit -m "feat(production): initialize production folder structure for full-stack app"
git push origin main
```

### 5. Start Development
- Backend: `cd production/backend && pip install -r requirements.txt && python main.py`
- Frontend: `cd production/frontend && npm install && npm run dev`
- Database: `psql -h localhost -U wedding_dev -d wedding`

---

## File Summary

### Updated Documentation Files (This Session)

1. **README.md** — Updated to reflect monorepo structure
2. **NEXT_STEPS.md** — Updated with clone instructions for monorepo
3. **SESSION_SUMMARY.md** — Updated to show monorepo architecture
4. **MONOREPO_GUIDE.md** — New! Complete git workflow for monorepo
5. **MONOREPO_FINAL_SUMMARY.md** — This file

### Unchanged Files

1. **schema.sql** — Database schema (ready to copy to `/production/database/`)
2. **setup-wedding-dev-vm.yml** — Ansible playbook (ready for future use)
3. **wedding-dashboard.gitignore** — Template (ready to append to root .gitignore)
4. **WEDDING_DASHBOARD_SETUP.md** — Architecture guide (still applicable)
5. **WEDDING_DB_SETUP_EXECUTION_LOG.md** — Execution record (historical)

---

## Committing Strategy

### When Working on Prototype
```bash
# (on your local machine)
cd ashley-hazel-wedding-portal
git checkout -b feature/prototype-new-component
# Edit prototype/ files
git commit -m "feat(prototype): add guest card component"
git push origin feature/prototype-new-component
# Create PR on GitHub
```

### When Working on Production
```bash
# (on wedding-db VM)
ssh deploy@192.168.0.32
cd ~/wedding-dashboard
git checkout -b feature/guests-import
# Edit production/backend/ or production/frontend/
git commit -m "feat(guests): add CSV import capability"
git push origin feature/guests-import
# Create PR on GitHub
```

### When Updating Docs
```bash
# (on wedding-db VM or local)
cd ~/wedding-dashboard
git checkout -b docs/add-api-guide
# Edit docs/ files or README.md
git commit -m "docs(api): add endpoint documentation"
git push origin docs/add-api-guide
# Create PR on GitHub
```

---

## Environment Files

### On wedding-db VM Only
```
~/.env.local                     ← Development (not committed)
DATABASE_URL=postgresql://...
```

### In Repo (Template)
```
.env.example                     ← Template (committed)
.env.production                  ← Production (committed, on VM)
```

Never commit actual `.env` files with passwords!

---

## Git Branches

```
main (stable)
├─ feature/prototype-cards      (Prototype work)
├─ feature/guests-import        (Production work)
├─ feature/budget-filters       (Production work)
├─ bugfix/rsvp-calculation      (Bug fixes)
└─ docs/setup-guide             (Documentation)

develop (integration)
├─ (all features merged here first)
└─ tested before merge to main
```

---

## Tag Strategy

For releases:
```
v1.0.0      ← Initial release
v1.0.1      ← Bug fixes
v1.1.0      ← New features
v2.0.0      ← Major changes
```

Both prototype and production versioned together since in same repo.

---

## Deployment Strategy (When Ready)

### Prototype
- Static files in `/prototype`
- Deploy to web server or GitHub Pages
- No backend needed

### Production
- Backend: FastAPI on wedding-db VM
- Frontend: React built and served by backend
- Database: PostgreSQL on wedding-db VM
- Docker Compose: For containerization (future)

When ready for infra-core:
```
1. Create /production/docker-compose.yml
2. Add Traefik routing
3. Move to infra-core
4. Set up production database
5. Deploy with Ansible
```

---

## Status Overview

### ✅ Completed
- VM provisioned (192.168.0.32)
- PostgreSQL installed and running
- Node.js and Python installed
- Git configured
- SSH key generated
- All documentation prepared

### 🔄 Next
- Add SSH deploy key to GitHub
- Clone monorepo to wedding-db VM
- Create `/production` folder structure
- First commit to GitHub
- Begin backend API development

### 📅 Timeline
- Today: GitHub setup + repo clone
- This week: Backend scaffolding + frontend layout
- Next week: Data import + CRUD endpoints
- Future: Full testing + production release

---

## Documentation Map

**For getting started:**
1. Read: `NEXT_STEPS.md` — Immediate actions
2. Read: `MONOREPO_GUIDE.md` — Git workflow

**For architecture:**
1. Read: `WEDDING_DASHBOARD_SETUP.md` — Full system design
2. Read: `docs/ARCHITECTURE.md` (when created)

**For setup:**
1. Read: `WEDDING_DB_SETUP_EXECUTION_LOG.md` — What was done
2. Follow: `NEXT_STEPS.md` — What to do next

**For development:**
1. Read: `MONOREPO_GUIDE.md` — Git workflow
2. Read: `production/README.md` (when created)

---

## Success Criteria

After completing next steps, you should have:

- ✅ SSH deploy key added to GitHub
- ✅ Monorepo cloned to wedding-db VM at ~/wedding-dashboard
- ✅ /production folder created with structure
- ✅ First commit pushed to GitHub
- ✅ Can run npm and python commands in /production
- ✅ PostgreSQL accessible for development
- ✅ Ready to start backend/frontend coding

---

## Quick Links

- **GitHub Repo:** https://github.com/VainAsher/ashley-hazel-wedding-portal
- **Dev VM:** ssh deploy@192.168.0.32
- **Database:** postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding
- **Git Workflow:** See MONOREPO_GUIDE.md

---

**The monorepo approach keeps everything unified while maintaining clear separation between prototype design work and production application development.**

**Ready to build! 🚀**
