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
See `/database/schema.sql` for complete schema.

## API
Backend runs on http://localhost:3001
Frontend runs on http://localhost:3000
