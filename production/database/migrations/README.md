# Database Migrations

SQL migration files for the wedding dashboard database.

## Naming Convention
- `001_init_schema.sql` — Initial schema creation
- `002_add_field.sql` — Subsequent migrations
- Sequential numbering for application order

## Applying Migrations
```bash
cd ~/wedding-dashboard/production/backend
set -a && . ./.env && set +a
cd ../database
psql "$DATABASE_URL" -f migrations/NNN_description.sql
```
