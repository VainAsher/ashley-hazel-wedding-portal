# Quick Reference - Wedding Dashboard Monorepo

## The Big Picture

**Single GitHub Repo:** `https://github.com/VainAsher/ashley-hazel-wedding-portal`

```
ashley-hazel-wedding-portal/
├── prototype/           ← UI/UX design (existing)
├── production/          ← Full-stack app (new)
├── docs/                ← Documentation
└── .env.example, .gitignore, README.md
```

---

## Essential Commands

### Setup (Do Once)

```bash
# 1. Add SSH key to GitHub
# Go to: github.com/VainAsher/ashley-hazel-wedding-portal/settings/keys
# Paste: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII2b+tsJfhvfTSapEPeqT5uECxSg4Q0m5iRu8kkAe0tY wedding-dev@192.168.0.32

# 2. Clone on wedding-db VM
ssh deploy@192.168.0.32
git clone https://github.com/VainAsher/ashley-hazel-wedding-portal.git ~/wedding-dashboard
cd ~/wedding-dashboard

# 3. Create production folders
mkdir -p production/{backend/app/{api,db,core},frontend/src,database/migrations}

# 4. First commit
git add production/
git commit -m "feat(production): initialize production folder structure"
git push origin main
```

### Daily Development

```bash
# SSH to VM
ssh deploy@192.168.0.32
cd ~/wedding-dashboard

# Create feature branch
git checkout -b feature/my-feature-name

# Edit files in production/
nano production/backend/app/api/guests.py
nano production/frontend/src/pages/Guests.tsx

# Commit
git add production/
git commit -m "feat(guests): add import from CSV"
git push -u origin feature/my-feature-name

# Create PR on GitHub → Review → Merge
```

### Database

```bash
# Connect to PostgreSQL
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding

# Create migration
cat > production/database/migrations/002_add_field.sql << 'EOF'
ALTER TABLE guests ADD COLUMN status VARCHAR(50);
EOF

# Apply migration
psql -h localhost -U wedding_dev -d wedding -f production/database/migrations/002_add_field.sql

# Commit migration
cd ~/wedding-dashboard
git add production/database/migrations/
git commit -m "chore(db): add status field to guests"
git push
```

### Start Dev Servers

```bash
# Terminal 1: Frontend
cd ~/wedding-dashboard/production/frontend
npm install  # (first time)
npm run dev  # Runs on http://localhost:3000

# Terminal 2: Backend
cd ~/wedding-dashboard/production/backend
pip install -r requirements.txt  # (first time)
python main.py  # Runs on http://localhost:3001
```

---

## Commit Messages

```bash
# Feature
git commit -m "feat(guests): add RSVP status filter"

# Bug fix
git commit -m "fix(budget): correct tax calculation"

# Database
git commit -m "chore(db): add email index to guests"

# Documentation
git commit -m "docs(api): add endpoint examples"

# Prototype
git commit -m "feat(prototype): add guest card animation"
```

---

## Important Paths

| Item | Path |
|------|------|
| **VM** | 192.168.0.32 |
| **SSH** | `ssh deploy@192.168.0.32` |
| **Repo (local)** | ~/wedding-dashboard/ |
| **Backend** | ~/wedding-dashboard/production/backend/ |
| **Frontend** | ~/wedding-dashboard/production/frontend/ |
| **Database** | ~/wedding-dashboard/production/database/ |
| **GitHub** | https://github.com/VainAsher/ashley-hazel-wedding-portal |
| **Database** | postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding |

---

## Git Workflow

```
1. Create branch:       git checkout -b feature/my-feature
2. Edit code:           nano file.py
3. Stage changes:       git add production/
4. Commit:              git commit -m "feat(scope): message"
5. Push:                git push -u origin feature/my-feature
6. Create PR:           On GitHub website
7. Get approval:        Wait for review
8. Merge:               On GitHub
9. Pull latest:         git pull origin main
10. Delete branch:      git branch -d feature/my-feature
```

---

## File Locations

### On Your Machine
```
C:\dev\ashley-hazel-wedding-portal-prototype\
├── schema.sql                   ← Database schema
├── README.md                    ← Prototype README
├── NEXT_STEPS.md               ← What to do next
├── MONOREPO_GUIDE.md           ← Git workflow
└── WEDDING_DASHBOARD_SETUP.md  ← Architecture
```

### On wedding-db VM
```
~/wedding-dashboard/
├── prototype/                  ← Existing (don't touch)
├── production/                 ← Your work
│   ├── backend/
│   ├── frontend/
│   └── database/
├── docs/
└── README.md
```

---

## Status Checks

```bash
# Check git status
git status

# View pending changes
git diff

# View recent commits
git log --oneline -5

# Check branch
git branch

# Verify database connection
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding -c "SELECT 1;"

# Check services
sudo systemctl status postgresql
```

---

## Environment

```bash
# Load environment (on wedding-db VM)
source ~/.env.local

# Current environment
echo $DATABASE_URL
echo $NODE_ENV
echo $API_PORT
```

---

## Help & Docs

| Question | Document |
|----------|----------|
| How do I get started? | `NEXT_STEPS.md` |
| How does the monorepo work? | `MONOREPO_GUIDE.md` |
| What was the architecture? | `WEDDING_DASHBOARD_SETUP.md` |
| What was done in setup? | `WEDDING_DB_SETUP_EXECUTION_LOG.md` |
| How do I develop? | `MONOREPO_GUIDE.md` (Development Workflows) |
| How do I commit? | This file (Commit Messages) |
| How do I deploy? | `DEPLOYMENT.md` (when created) |

---

## Key Info

**Repo:** `https://github.com/VainAsher/ashley-hazel-wedding-portal`  
**VM:** `ssh deploy@192.168.0.32`  
**Database:** `postgresql://wedding_dev:wedding_dev_2026@localhost:5432/wedding`  
**Backend:** `http://localhost:3001`  
**Frontend:** `http://localhost:3000`  
**SSH Key:** `~/.ssh/id_ed25519`  

---

## ⚠️ Important

- ✅ Never commit `.env` files (use `.env.example`)
- ✅ Never commit passwords (use Vault)
- ✅ Always use feature branches
- ✅ Test before pushing
- ✅ Write clear commit messages
- ✅ Pull before starting new work
- ✅ Don't force-push to main

---

**That's it! Everything else is in the documentation. Happy coding! 🚀**
