# Wedding Dashboard - Production Application

Full-stack wedding planning and coordination platform.

## Stack
- **Backend:** FastAPI (Python 3.12)
- **Frontend:** React with TypeScript
- **Database:** PostgreSQL 15

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set DATABASE_URL for your local PostgreSQL database.
python main.py
```

The backend fails fast when required configuration is missing. At minimum, set:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/wedding
```

Never commit `.env`; only `.env.example` belongs in git.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Database
See `database/schema.sql` for the base schema applied at first boot, and
`database/migrations/` (002–011) for incremental changes applied by
`scripts/deploy.sh`. See `database/migrations/README.md` for the apply model.

Note: `schema.sql` defines five tables that the backend does not model or use —
`users`, `tables`, `seating_arrangements`, `gifts`, and `attire`. They exist in
the database but have no corresponding SQLAlchemy models or API endpoints.

## API
Backend runs on http://localhost:3001
Frontend runs on http://localhost:3000

Health endpoints:
- `GET /health` — liveness probe; reports the process is up. Does not touch the DB.
- `GET /health/ready` — readiness probe; runs a DB query and returns 503 if the
  database is unreachable or the core schema is missing.
