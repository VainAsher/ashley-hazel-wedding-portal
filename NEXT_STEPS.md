# Wedding Dashboard - Next Steps

**Date:** 2026-06-10  
**Status:** ✅ Development VM Ready — Ready for GitHub Setup  
**Location:** All dev work on 192.168.0.32 (wedding-db VM)

---

## Immediate Actions (Do Now)

### 1. Add SSH Deploy Key to Existing GitHub Repo

The repo already exists at: `https://github.com/VainAsher/ashley-hazel-wedding-portal`

1. Go to: `https://github.com/VainAsher/ashley-hazel-wedding-portal/settings/keys`
2. Click "Add deploy key"
3. Title: `wedding-db-dev`
4. Key: Copy from below (or get from `ssh deploy@192.168.0.32 "cat ~/.ssh/id_ed25519.pub"`)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII2b+tsJfhvfTSapEPeqT5uECxSg4Q0m5iRu8kkAe0tY wedding-dev@192.168.0.32
```

5. Check "Allow write access"
6. Click "Add key"

### 2. Clone Existing Repo and Add Production Folder on wedding-db VM

```bash
ssh deploy@192.168.0.32

# Clone the existing repo
git clone https://github.com/VainAsher/ashley-hazel-wedding-portal.git ~/wedding-dashboard
cd ~/wedding-dashboard

# Verify current structure
ls -la
# Should see: prototype/, docs/, etc.

# Create production folder structure
mkdir -p production/{backend,frontend,database/migrations}

# Verify
ls -la production/
```

### 3. Initialize Production Folder as Development Root

```bash
cd ~/wedding-dashboard/production

# Create initial backend structure
mkdir -p backend/app/{api,db,core}
touch backend/app/__init__.py
touch backend/requirements.txt
touch backend/main.py

# Create initial frontend structure
mkdir -p frontend/src/{components,pages,hooks,styles}
touch frontend/package.json
touch frontend/tsconfig.json

# Create database folder
touch database/schema.sql
mkdir -p database/migrations

# Create dotenv in root (wedding-dashboard, not production)
cd ~/wedding-dashboard
cat > .env.production << 'EOF'
DATABASE_URL=postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding
NODE_ENV=development
API_PORT=3001
FRONTEND_PORT=3000
COORDINATOR_AUTH_ENABLED=true
LOG_LEVEL=debug
EOF

# First commit
git add production/
git commit -m "feat(production): initialize production folder structure for full-stack app"

# Push to GitHub
git push origin main
```

---

## Files to Commit to Git

### From This Session (Copy to ashley-hazel-wedding-portal repo)

```
From: C:/dev/ashley-hazel-wedding-portal-prototype/

Copy to: ~/wedding-dashboard/production/ on 192.168.0.32

Files:
├── production/
│   └── database/
│       └── schema.sql (copied from schema.sql in prototype folder)
├── .gitignore (append wedding-dashboard.gitignore to existing)
├── docs/ (add to root docs/)
│   ├── PRODUCTION_SETUP.md
│   ├── PRODUCTION_ARCHITECTURE.md
│   ├── PRODUCTION_DATABASE.md
│   ├── API.md
│   └── DEVELOPMENT.md
└── Update root README.md with production sections
```

### Monorepo Structure (ashley-hazel-wedding-portal)

```
ashley-hazel-wedding-portal/        ← Single GitHub repo
│
├── prototype/                       ← Existing (keep as-is)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data/
│   ├── docs/
│   └── ... (existing prototype files)
│
├── production/                      ← New development folder
│   ├── backend/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── guests.py
│   │   │   │   ├── budget.py
│   │   │   │   ├── vendors.py
│   │   │   │   ├── tasks.py
│   │   │   │   └── events.py
│   │   │   ├── db/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── database.py
│   │   │   │   └── models.py
│   │   │   ├── core/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── config.py
│   │   │   │   └── security.py
│   │   │   └── schemas.py
│   │   ├── tests/
│   │   │   ├── __init__.py
│   │   │   ├── test_api.py
│   │   │   └── conftest.py
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
│   │   ├── schema.sql          ← Copy from prototype/schema.sql
│   │   ├── migrations/
│   │   │   ├── 001_init_schema.sql
│   │   │   └── README.md
│   │   └── seeds/
│   │       └── sample_data.sql
│   │
│   ├── docker-compose.yml
│   └── README.md
│
├── docs/                        ← Root documentation
│   ├── ARCHITECTURE.md
│   ├── PRODUCTION_SETUP.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   └── PROTOTYPE.md
│
├── .env.example
├── .env.production
├── .gitignore                   ← Updated with Python + Node + secrets
├── README.md                    ← Updated root README
└── DEPLOYMENT.md
```

**Key Points:**
- `prototype/` — Existing UI/UX design (untouched)
- `production/` — New full-stack application
- `docs/` — Shared documentation for both
- Root level — Configuration and deployment files

---

## Development Workflow

### Starting a Development Session

```bash
# SSH to VM
ssh deploy@192.168.0.32

# Navigate to app
cd ~/wedding-dashboard

# Load environment
source ~/.env.local

# Pull latest from GitHub
git pull origin develop

# Create feature branch
git checkout -b feature/your-feature-name
```

### During Development

```bash
# Frontend (Terminal 1)
cd frontend
npm install  # (first time only)
npm run dev  # Runs on http://localhost:3000

# Backend (Terminal 2)
cd backend
pip install -r requirements.txt  # (first time only)
python main.py  # Runs on http://localhost:3001
```

### Committing Changes

```bash
# Check what changed
git status

# Stage changes
git add src/components/GuestList.tsx
git add backend/app/api/guests.py

# Commit with clear message
git commit -m "feat(guests): add RSVP status filter to list view"

# Push to feature branch
git push -u origin feature/your-feature-name

# Create Pull Request on GitHub
# → Assign to couple/coordinator for review
# → Merge to develop after approval
```

### Merging to Main (Release)

```bash
# After testing on develop
git checkout develop
git pull origin develop

git checkout main
git pull origin main

git merge develop

# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0 - Initial wedding dashboard"

git push origin main --tags
```

---

## Database Workflow

### Making Schema Changes

```bash
# Create migration file
cat > database/migrations/002_add_gift_category.sql << 'EOF'
-- Migration: Add gift category field
ALTER TABLE gifts ADD COLUMN category VARCHAR(100);
CREATE INDEX idx_gifts_category ON gifts(category);
EOF

# Apply migration
cd ~/wedding-dashboard
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding \
  -f database/migrations/002_add_gift_category.sql

# Commit migration
git add database/migrations/002_add_gift_category.sql
git commit -m "chore(db): add gift category field"
git push
```

---

## Quick Commands

### SSH to VM
```bash
ssh deploy@192.168.0.32
```

### Database Access
```bash
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding
```

### Check Services
```bash
# PostgreSQL
sudo systemctl status postgresql

# Ports
netstat -tlnp | grep -E "3000|3001|5432"
```

### View Logs
```bash
# Backend
tail -f backend/app.log

# Frontend
npm run dev  # Shows logs in terminal
```

---

## Important Notes

⚠️ **Never commit .env.local** — It contains the database password  
⚠️ **Never edit schema directly** — Always use migrations  
⚠️ **Always use feature branches** — Keep main clean and stable  
⚠️ **Test before pushing** — Run tests locally first  
⚠️ **Keep secrets in Vault** — Use .env.example as template

---

## Success Criteria

After completing next steps, you should have:

- ✅ GitHub repository created
- ✅ SSH deploy key added to GitHub
- ✅ Initial project structure committed
- ✅ README.md with clear setup instructions
- ✅ Database schema loaded
- ✅ Git log shows initial commits
- ✅ Can run `npm run dev` and `python main.py`
- ✅ Couple/Coordinator can access via GitHub

---

## Timeline

**Today:** GitHub setup + initial repo  
**This Week:** Backend scaffolding + Frontend layout  
**Next Week:** Data import + Basic CRUD  
**Phase 2:** Full testing + Coordinator dashboard  
**Phase 3:** Production release (Docker Compose on infra-core)

---

## Support

**For issues:**
- SSH to 192.168.0.32 for VM access
- Check PostgreSQL: `sudo systemctl status postgresql`
- Check GitHub SSH: `ssh -T git@github.com`
- Review git config: `git config --global --list`

**Resources:**
- Schema: `database/schema.sql`
- Setup guide: `docs/SETUP.md`
- Architecture: `docs/ARCHITECTURE.md`
- Execution log: `WEDDING_DB_SETUP_EXECUTION_LOG.md`

---

**You're ready to start! 🚀**

Next action: Create GitHub repo → Add SSH key → Clone and commit.
