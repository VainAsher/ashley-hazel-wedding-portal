# Wedding Dashboard - Development Environment Setup

**Status:** Initial infrastructure configuration  
**Target VM:** wedding-db (192.168.0.32) on pve-02  
**Database:** PostgreSQL 15  
**Stack:** FastAPI (Python) + React (TypeScript)  
**Repository:** https://github.com/VainAsher/wedding-dashboard  

---

## Architecture Overview

### Two-Track Development

**Track 1: Prototype** (ashley-hazel-wedding-portal-prototype)
- Static HTML/CSS/JS prototype
- UI/UX design baseline
- Component library reference
- Design system documentation

**Track 2: Production** (wedding-dashboard on wedding-db VM)
- Full-stack development environment
- PostgreSQL 15 database
- FastAPI backend API
- React frontend coordinator dashboard
- GitHub integration for version control

### Infrastructure

```
┌─────────────────────────────────────────────────┐
│           Proxmox Cluster                       │
├─────────────────────────┬───────────────────────┤
│ pve-03 (R620)           │ pve-02 (E5645 x2)    │
│ 64GB RAM, 40 threads    │ 24GB RAM, 24 threads │
│                         │                       │
│ ├─ wings-01 (.30)       │ ├─ infra-core (.23)  │
│ ├─ pterodactyl (.31)    │ ├─ media-stack (.25) │
│ ├─ saas-platform (.60)  │ └─ wedding-db (.32)  │
│ ├─ client-hosting (.40) │    [NEW - Dev VM]    │
│ ├─ internal-tools (.41) │                       │
│ └─ csagent (.62)        │                       │
└─────────────────────────┴───────────────────────┘
```

### Wedding-db VM Specifications

- **Hostname:** wedding-db
- **IP Address:** 192.168.0.32
- **Node:** pve-02
- **CPU:** 2 cores
- **RAM:** 4GB
- **Disk:** 30GB
- **OS:** Ubuntu 22.04 LTS (cloud-init)
- **Database:** PostgreSQL 15
- **Stack:** Node.js 18, Python 3.10, npm, pip

---

## Setup Phases

### Phase 1: Infrastructure (Terraform + Ansible)

**Steps:**
1. Add wedding-db VM to terraform config ✅ DONE
   - File: `proxmox/terraform/clusters/prod.tfvars`
   - Entry: wedding-db on pve-02
   
2. Apply Terraform to provision VM
   ```bash
   cd proxmox/terraform
   terraform plan -var-file clusters/prod.tfvars
   terraform apply -var-file clusters/prod.tfvars
   ```

3. Run Ansible setup playbook
   ```bash
   ansible-playbook -i proxmox/ansible/inventory/hosts.yml \
     proxmox/ansible/playbooks/setup-wedding-dev-vm.yml
   ```

**Playbook covers:**
- System packages (PostgreSQL, Node, Python, Git)
- PostgreSQL 15 setup with wedding database
- Database schema loading (schema.sql)
- GitHub SSH key generation
- Git user configuration
- Environment file (.env.local)
- Application directory structure

### Phase 2: GitHub Repository Setup

**Initial repo structure:**
```
wedding-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── guests.py
│   │   │   │   ├── budget.py
│   │   │   │   ├── vendors.py
│   │   │   │   ├── tasks.py
│   │   │   │   └── events.py
│   │   │   └── models.py
│   │   ├── db/
│   │   │   ├── database.py
│   │   │   └── schemas.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   └── __init__.py
│   ├── migrations/
│   │   ├── 001_init_schema.sql
│   │   └── README.md
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_guests.py
│   │   └── test_budget.py
│   ├── requirements.txt
│   ├── main.py
│   └── README.md

├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GuestList.tsx
│   │   │   ├── BudgetTracker.tsx
│   │   │   ├── TaskBoard.tsx
│   │   │   ├── VendorForm.tsx
│   │   │   └── SeatingChart.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Guests.tsx
│   │   │   ├── Budget.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── Coordination.tsx
│   │   ├── hooks/
│   │   │   ├── useGuests.ts
│   │   │   ├── useBudget.ts
│   │   │   └── useApi.ts
│   │   ├── styles/
│   │   │   ├── theme.css
│   │   │   └── components.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts

├── database/
│   ├── schema.sql
│   ├── migrations/
│   │   └── 001_init.sql
│   └── seeds/
│       └── sample_data.sql

├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── SETUP.md
│   └── DEVELOPMENT.md

├── .env.example
├── .gitignore
├── docker-compose.yml
├── Makefile
└── README.md
```

**Steps:**
1. Create GitHub repo: `https://github.com/VainAsher/wedding-dashboard`
2. Add SSH deploy key from wedding-db VM to GitHub
3. Clone onto wedding-db VM: `git clone <repo> ~/wedding-dashboard`
4. Initialize structure with above files
5. First commit: `feat: initial project structure`

### Phase 3: Backend Development

**FastAPI Application:**
- Setup SQLAlchemy ORM for PostgreSQL
- Create database models from schema
- Implement CRUD endpoints for all entities
- Add authentication (initial: simple token auth, later: OIDC via Authentik)
- Implement role-based access control (couple, party, coordinator, guest)
- Add request validation with Pydantic
- Setup logging and error handling
- Create API documentation (auto-generated with FastAPI)

**Key Endpoints:**
```
POST   /api/guests              - Create guest
GET    /api/guests              - List guests
PUT    /api/guests/{id}         - Update guest
DELETE /api/guests/{id}         - Delete guest
PATCH  /api/guests/{id}/rsvp    - Update RSVP status

POST   /api/budget              - Create budget item
GET    /api/budget              - List with filtering
PUT    /api/budget/{id}         - Update cost/status

POST   /api/vendors             - Create vendor
GET    /api/vendors             - List by category
PUT    /api/vendors/{id}        - Update vendor info

POST   /api/tasks               - Create task
GET    /api/tasks               - List with status filter
PATCH  /api/tasks/{id}/status   - Update task status

GET    /api/events              - Timeline view
POST   /api/events              - Create event
```

### Phase 4: Frontend Development

**React Coordinator Dashboard:**
- Main layout with sidebar navigation
- Guest management interface
  - Table view with sorting/filtering
  - RSVP status tracking
  - Dietary restrictions management
  - Plus-one assignment
- Budget dashboard
  - Category breakdown (pie/bar charts)
  - Estimated vs actual comparison
  - Vendor cost tracking
- Task coordinator board
  - Kanban view (not started / in progress / completed)
  - Assignment tracking
  - Due date warnings
- Vendor management
  - Contact information
  - Contract tracking
  - Payment status
- Timeline view
  - Calendar with scheduled events
  - Task dependencies
- Seating chart (placeholder for later)

### Phase 5: Data Migration

**From Google Sheets:**
1. Export current spreadsheet to CSV
2. Parse each sheet into database tables
3. Validate data integrity
4. Load into PostgreSQL
5. Test coordinator access
6. Validate calculations (budget, RSVP counts)

### Phase 6: Testing & Validation

**Test Coverage:**
- Unit tests for backend (pytest)
- Integration tests for API endpoints
- Frontend component tests (Vitest + React Testing Library)
- End-to-end tests (Cypress or Playwright)
- Manual coordinator workflow tests

**Testing Scenarios:**
- Guest RSVP updates cascade correctly
- Budget calculations stay accurate
- Task assignments notify assignees
- Permissions work per role
- Database constraints enforce integrity

---

## Development Workflow

### Getting Started

```bash
# SSH to dev VM
ssh deploy@192.168.0.32

# Navigate to app
cd ~/wedding-dashboard

# Load environment
source .env.local

# Install dependencies
npm install              # Frontend
pip install -r requirements.txt  # Backend

# Start dev servers
npm run dev             # Frontend on port 3000
python main.py          # Backend on port 3001
```

### Git Workflow

**Feature development:**
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/guest-import-from-sheets

# Make changes, commit frequently
git commit -m "feat(guests): add CSV import dialog"

# Push feature branch
git push -u origin feature/guest-import-from-sheets

# Create Pull Request on GitHub
# Link to issues: Fixes #WD-001

# Code review + merge to develop
# After testing, merge develop → main for release
```

**Commit Messages:**
```
feat(scope): description       # New feature
fix(scope): description        # Bug fix
docs(scope): description       # Documentation
refactor(scope): description   # Code restructuring
test(scope): description       # Tests
chore(scope): description      # Dependencies, config

# Examples
feat(guests): add RSVP status filter
fix(budget): correct tax calculation
docs(api): add endpoint documentation
```

### Database Migrations

**Creating migrations:**
```bash
# Create migration file
cat > database/migrations/002_add_gift_category.sql << 'EOF'
ALTER TABLE gifts ADD COLUMN category VARCHAR(100);
EOF

# Apply migration
psql -h localhost -U wedding_dev -d wedding -f database/migrations/002_add_gift_category.sql

# Commit to git
git add database/migrations/
git commit -m "chore(db): add gift category column"
```

---

## Pre-Production Development Policy

✅ **All code development on wedding-db VM (192.168.0.32)**
✅ **GitHub is source of truth** — daily commits
✅ **Database changes via migrations** — no direct schema edits
✅ **Feature branches** — develop features off `develop` branch
✅ **Code reviews** — couple/coordinator approval before merge
✅ **Testing** — manual + automated tests before release
✅ **No production deployment yet** — focus on development completeness

### Key Rules

1. **Never edit schema directly** — use migrations
2. **Never commit .env files** — use .env.example as template
3. **Never push secrets** — use Vault for production secrets
4. **Test on this VM only** — no other testing environments yet
5. **Backup database regularly** — automated backups via infra-core
6. **Document changes** — commit messages + docs/ updates

---

## Database Schema Summary

**Tables (from schema.sql):**
- `weddings` — Master wedding record
- `wedding_party` — Bride, groom, bridesmaids, groomsmen
- `users` — Coordinator + couple logins
- `guests` — Full guest list
- `vendors` — Caterers, photographers, florists, etc.
- `budget_categories` & `budget_items` — Cost tracking
- `tasks` — Coordinator to-do items
- `events` — Timeline (ceremony, reception, rehearsal)
- `tables` & `seating_arrangements` — Seating (for later)
- `gifts` — Registry tracking
- `attire` — Wedding party clothing

**User Roles:**
- `couple` — Ashley & Hazel (read/write all except user management)
- `wedding_party` — Samson & Kelly (read/write assigned tasks, view guest list)
- `coordinator` — Wedding coordinator (read/write everything except user management)
- `guest` — Wedding guests (read-only RSVP status, music requests, blessings wall)

---

## Next Steps

### This Week
1. ✅ Schema design complete
2. ✅ Terraform config updated
3. 🔄 Run Terraform to provision wedding-db VM
4. 🔄 Run Ansible playbook to configure VM
5. 🔄 Create GitHub repo with initial structure
6. 🔄 Test database access from local dev machine

### Next Week
1. Start backend API (FastAPI scaffolding)
2. Create database ORM models
3. Implement guest management endpoints
4. Begin frontend with Dashboard layout
5. Import data from Google Sheets

### Coordinator Handoff
1. Deployed coordinator dashboard
2. User accounts configured
3. Permission levels tested
4. Data import complete
5. Live testing with wedding party

---

## Commands Reference

**Provisioning:**
```bash
# In proxmox/terraform/
terraform plan -var-file clusters/prod.tfvars
terraform apply -var-file clusters/prod.tfvars

# Run setup playbook
ansible-playbook -i proxmox/ansible/inventory/hosts.yml \
  proxmox/ansible/playbooks/setup-wedding-dev-vm.yml
```

**Development:**
```bash
ssh deploy@192.168.0.32
cd ~/wedding-dashboard

# Database access
psql -h localhost -U wedding_dev -d wedding

# Frontend dev
npm install && npm run dev

# Backend dev
pip install -r requirements.txt && python main.py

# Git operations
git status
git checkout -b feature/name
git commit -m "type(scope): message"
git push -u origin feature/name
```

---

## Contacts & Resources

- **Coordinator:** [To be assigned]
- **Repository:** https://github.com/VainAsher/wedding-dashboard
- **Dev VM:** 192.168.0.32 (wedding-db)
- **Database:** PostgreSQL 15 on wedding-db
- **Prototype:** /ashley-hazel-wedding-portal-prototype/

---

**Status:** Setup documentation complete — awaiting Terraform/Ansible execution
**Last Updated:** 2026-06-10
