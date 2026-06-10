# Database Migrations

SQL migration files for the wedding dashboard database.

## Naming Convention
- `001_init_schema.sql` — Initial schema creation
- `002_add_field.sql` — Subsequent migrations
- Sequential numbering for application order

## Applying Migrations
```bash
PGPASSWORD='wedding_dev_2026' psql -h localhost -U wedding_dev -d wedding -f migrations/NNN_description.sql
```
