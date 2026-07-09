# Production Runbook — Ashley & Hazel Wedding Portal

> **Status (2026-07-10):** production has been live since 2026-06-26 (v1.0.0; now
> v1.1.0-rc1, phase `live`). The one-time setup/go-live sections below are kept as the
> record and for rebuild scenarios; day-to-day ops live in
> `docs/guides/IT_ADMIN_GUIDE.md`.

Production is an **isolated Docker stack on the wedding VM (`192.168.0.32`)**,
running alongside staging, fronted by **Cloudflare Tunnel + Traefik on infra-core
(`.23`)**, serving **https://ashley-and.hazel-of-halifax.com**. It holds **real
wedding data** — handle with care, and complete the privacy checklist
(`docs/privacy/DATA_BOUNDARY.md`) before entering any real guest PII.

## Topology

- **App:** a separate Compose project `wedding-prod` on `.32` — containers
  `wedding-prod-*`, volumes `wedding-prod-*`, network `wedding-prod`, database
  `wedding_prod`. The frontend publishes host port **8090**; the DB and backend
  publish **no** host ports (reachable only inside the prod network).
- **Edge:** Cloudflared + Traefik (`.23`) route the subdomain →
  `http://192.168.0.32:8090`; TLS is terminated at the Cloudflare edge.
- **Isolation:** prod never shares volumes / DB / containers / network with
  staging (enforced by `docker-compose.prod.yml` + `COMPOSE_PROJECT_NAME=wedding-prod`
  in `deploy.sh`), so a staging deploy can never read or overwrite prod data.

## One-time setup (operator)

1. **Separate checkout** on `.32`: clone the repo to a prod-only directory
   (e.g. `/home/deploy/wedding-prod`) so prod has its own working tree, `.env`,
   and `.deploy` state, independent of staging. (`deploy.sh` derives all paths
   from its own location.)
2. **Prod env:** copy `production/.env.production.example` → `production/.env` in
   the prod checkout and fill `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`,
   `SESSION_SECRET_KEY` (each ≥16 chars, **unique to prod**). Keep
   `FRONTEND_HOST_PORT=8090`, `POSTGRES_DB=wedding_prod`, and the `https://` URLs.
3. **Cloudflare edge** — verified against the live `.23` setup (2026-06-25): every
   hostname on the `infra-core` tunnel `f0b1403c-f9ec-4ffa-ba9c-0e4673c0444b` routes
   to **Traefik** at `https://127.0.0.1:443` (e.g. `home.hazel-of-halifax.com`
   already does); there is no wedding route yet. Follow the same pattern:
   - **DNS:** CNAME `ashley-and.hazel-of-halifax.com` →
     `f0b1403c-f9ec-4ffa-ba9c-0e4673c0444b.cfargotunnel.com` (proxied).
   - **Tunnel ingress** (`/etc/cloudflared/config.yml` on `.23`): add an entry
     `- hostname: ashley-and.hazel-of-halifax.com` / `service: https://127.0.0.1:443`
     (into Traefik, like the other services — NOT directly to the app), then
     restart cloudflared.
   - **Traefik route** (`.23`, dynamic/file provider): a router for
     ``Host(`ashley-and.hazel-of-halifax.com`)`` → a service pointing at
     `http://192.168.0.32:8090` (the prod frontend on the wedding VM). Cloudflare
     terminates TLS at the edge; Traefik terminates it at the origin.
   - **Rate-limit rule** (Cloudflare WAF) on path `*/api/auth/login` (e.g. > 10
     requests/min per IP → managed-challenge/block) to blunt invite-code brute force.
4. **GitHub `production` Environment** — it **already exists**, but verification
   (2026-06-25) found it has **no required reviewers** and **no environment-scoped
   secrets/variables**. As-is, a prod dispatch would NOT pause for approval and
   would inherit the **repo-level (staging) secrets** — including `DEPLOY_PATH`,
   which would make a prod deploy run inside **staging's checkout**. Before any prod
   deploy, on the `production` Environment (repo → Settings → Environments):
   - Add **yourself as a required reviewer** (so prod deploys pause for approval).
   - Add **environment-scoped** secrets that override the repo-level ones for prod:
     `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`
     (each unique to prod), and **`DEPLOY_PATH`** pointing at the prod checkout
     (e.g. `/home/deploy/wedding-prod`). `DEPLOY_HOST` / `DEPLOY_USER` /
     `DEPLOY_SSH_KEY` can stay repo-level (same `.32` host); `SENTRY_DSN` optional.
   - Non-secret prod config (URLs, `POSTGRES_DB`, `FRONTEND_HOST_PORT`) lives in
     `production/.env` on the host.

## Pre-deploy verification (confirmed 2026-06-25)

Already verified against the live homelab (read-only): `.32` runs Docker Compose
**v5.1.4** (the `!reset`/`!override` merge tags are supported); staging occupies
`80/3001/5432` (no clash with prod's `8090`); and the merged prod compose renders
correctly — distinct `wedding-prod-*` containers/volumes/network, `wedding_prod`
DB, frontend published on **8090 only**, db/backend host ports closed. Re-run that
render any time (read-only — it does not deploy):

```bash
# on .32, in the prod checkout:
POSTGRES_PASSWORD=x JWT_SECRET=xxxxxxxxxxxxxxxx API_KEY_SECRET=xxxxxxxxxxxxxxxx \
SESSION_SECRET_KEY=xxxxxxxxxxxxxxxx FRONTEND_HOST_PORT=8090 POSTGRES_DB=wedding_prod \
ENVIRONMENT=production COMPOSE_PROJECT_NAME=wedding-prod \
docker compose -f docker-compose.yml -f docker-compose.prod.yml config \
  | grep -E 'container_name:|name: wedding|published:|POSTGRES_DB'
```

## First deploy (manual only)

GitHub Actions → **Deploy** → Run workflow → environment **production**, action
**deploy** → approve the review gate. (Or on the prod host:
`DEPLOY_ENVIRONMENT=production bash production/scripts/deploy.sh`.)

`deploy.sh` builds SHA-tagged images, brings up the `wedding-prod` stack
(health-gated), reconciles the DB password, and applies migrations `002–011`. The
demo seed `008` is fenced out of the migration glob, so **production starts with
no demo data**.

## Bootstrap the real wedding (once, after first deploy)

```bash
docker exec -it -w /app wedding-prod-backend python -m scripts.bootstrap_prod \
  --couple-names "Ashley & Hazel" --date 2027-06-19 \
  --ceremony-time 14:00 \
  --ceremony-location "<ceremony venue>" \
  --reception-location "<reception venue>"
```

> The image ships `scripts/bootstrap_prod.py` (the demo seeders stay out — see
> `backend/.dockerignore`). If you're on an image built **before** that change,
> copy the script in first:
> `docker cp ~/wedding-prod/production/backend/scripts/bootstrap_prod.py wedding-prod-backend:/app/bootstrap_prod.py`
> then run `docker exec -it -w /app wedding-prod-backend python /app/bootstrap_prod.py …`.

Record the printed **couple** and **coordinator** invite codes securely. The
wedding starts in phase **planning** (guest RSVP closed) — the bootstrap also
updates the schema's placeholder wedding row to your details and forces
`planning`. Do your planning; when ready to invite, generate guest invite codes
in the admin **Invitations** module and flip the phase to **live** in **Settings**.

## Backups

- **VM-level:** PBS already snapshots the VM.
- **DB-level:** schedule `production/scripts/backup.sh` on `.32` (systemd timer /
  cron, nightly). It `pg_dump`s `wedding_prod` from the container, gzips to
  `/home/deploy/wedding-prod-backups`, and retains 14 days. Set
  `BACKUP_OFFSITE_DEST` to the NAS (`192.168.0.176`) once it's resized.
- **Drill:** periodically run `production/scripts/restore.sh <dump>` — it restores
  into a throwaway DB (not live), proving the backups are usable.

## Go-live checklist

- [ ] `wedding-prod` stack healthy; `https://ashley-and.hazel-of-halifax.com/health`
      and `/health/ready` both 200.
- [ ] TLS valid; only the subdomain reachable; prod DB + backend not host-exposed
      (`docker ps` shows no published 5432/3001 for `wedding-prod-*`).
- [ ] Couple logs in over HTTPS with the real couple code; admin loads.
- [ ] Phase `planning` blocks guest RSVP; flipping to `live` (test) opens it; set
      back to `planning` until you're ready to invite.
- [ ] `backup.sh` produces a dump; `restore.sh` restores it into the throwaway DB.
- [ ] Cloudflare rate-limit rule active on `/api/auth/login`.
- [ ] A **staging** deploy runs and does NOT alter prod volumes/data (confirm
      `wedding-prod-pgdata` is untouched).
- [ ] Privacy checklist in `docs/privacy/DATA_BOUNDARY.md` signed before real PII.

## Rollback

`DEPLOY_ENVIRONMENT=production bash production/scripts/deploy.sh` with the rollback
action (or the workflow's rollback) re-ups the previous image tag. Data volumes
are preserved across deploys.
