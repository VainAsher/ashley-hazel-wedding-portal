# Data Boundary

Date: 2026-06-09

## Rule

This repo is wedding/PII-sensitive by domain. Use synthetic or placeholder data until explicitly approved otherwise.

## Allowed

- fake guest names
- fake household groupings
- fake meal choices
- fake budget rows
- fake music requests
- fake blessing-wall messages
- UI screenshots that contain only placeholder data

## Not Allowed

- real guest names
- real addresses
- real phone numbers
- real email addresses
- real dietary/accessibility notes
- real RSVP answers
- real invite codes
- private budget/account details
- exported guest spreadsheets

## Before Real Data — the five models

These are the pre-approval items, now defined for the production environment (see
`docs/ci/PRODUCTION_RUNBOOK.md`). Real guest PII may be entered only once the couple
have reviewed these and ticked the sign-off checklist below.

1. **Storage model** — Real data lives only in the isolated production Postgres
   (`wedding_prod` DB on the `wedding-prod-pgdata` volume), on the `.32` VM. The DB
   and backend publish no host ports; only the frontend (`:8090`) is reachable, and
   only via the Cloudflare edge. Secrets come from the GitHub `production`
   Environment / the host `production/.env` (never committed). No real PII in the
   repo, in staging, in CI, or in seed/fixture data.
2. **Access model** — Read/write access to real data is via (a) the admin UI, which
   requires a couple/coordinator invite code over HTTPS, and (b) the database
   directly, only over `deploy@.32` SSH. No third party, no public DB exposure.
   Guests can read/update only their own RSVP.
3. **Backup/export model** — VM-level PBS snapshots **plus** nightly logical
   `pg_dump` (`production/scripts/backup.sh`, gzipped, 14-day retention, offsite to
   NAS `.176` once resized). Restores are drill-tested via `restore.sh` into a
   throwaway DB. Per-guest export/delete is available to admins via the API.
4. **Data retention rule** — Retain wedding data until **6 months after the wedding
   date**, then purge (delete the wedding's guests/RSVPs/blessings/gallery and the
   DB dumps). Guests may request earlier deletion; admins remove a guest's record
   via `DELETE /api/guests/{id}`.
5. **Manual privacy review checklist** — the sign-off below.

### Privacy review sign-off (complete before entering real PII)

- [ ] Production is the **isolated** `wedding-prod` stack; staging/CI hold no real data.
- [ ] Production starts with **no demo data** (migration `008` is fenced out); the
      real wedding was created via `bootstrap_prod.py`.
- [ ] Secrets are unique to production and not in the repo.
- [ ] TLS is enforced end-to-end (Cloudflare edge); only the subdomain is reachable.
- [ ] `backup.sh` is scheduled and a `restore.sh` drill has succeeded.
- [ ] The retention rule above is understood and agreed by the couple.
- [ ] Couple sign-off: ____________________  Date: __________

## Current status (v1.0.0-rc1)

**Staging** holds synthetic/demo data only (seeded by `008_seed_test_data.sql`:
"Demo Guest", "Alice Anderson", … and the `DEMO-*` invite codes). The new **isolated
production stack starts empty of demo data** (008 is fenced out of the prod migration
glob; the real wedding is created by `bootstrap_prod.py`). The five models above are
now defined; **real PII may be entered only after the sign-off checklist is ticked.**
