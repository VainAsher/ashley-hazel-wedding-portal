# Production Runbook — Ashley & Hazel Wedding Portal

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
3. **Cloudflare:**
   - DNS: CNAME `ashley-and.hazel-of-halifax.com` → your tunnel
     (`<tunnel-id>.cfargotunnel.com`), proxied.
   - Tunnel ingress (cloudflared on `.23`): route
     `ashley-and.hazel-of-halifax.com → http://192.168.0.32:8090` (directly, or
     via Traefik).
   - **Rate-limit rule** (WAF) on path `*/api/auth/login` (e.g. > 10 requests/min
     per IP → block/managed-challenge) to blunt invite-code brute force.
4. **GitHub `production` Environment** (for Actions-driven prod deploys):
   - Create it (repo → Settings → Environments) and set **yourself as a required
     reviewer**, so prod deploys pause for manual approval.
   - Environment secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`,
     `SESSION_SECRET_KEY`, plus `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` /
     `DEPLOY_PATH` pointing at the prod checkout; optional `SENTRY_DSN`.
     Non-secret prod config (URLs, `POSTGRES_DB`, `FRONTEND_HOST_PORT`) can live in
     `production/.env` on the host.

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
docker exec -it wedding-prod-backend python -m scripts.bootstrap_prod \
  --couple-names "Ashley & Hazel" --date 2027-06-19 \
  --ceremony-time 14:00 \
  --ceremony-location "<ceremony venue>" \
  --reception-location "<reception venue>"
```

Record the printed **couple** and **coordinator** invite codes securely. The
wedding starts in phase **planning** (guest RSVP closed). Do your planning; when
ready to invite, generate guest invite codes in the admin **Invitations** module
and flip the phase to **live** in **Settings**.

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
