# Agent 6 → Agent 7 Handover: Final Staging Deployment & E2E Validation

Agent 6 delivered the GitHub Actions deployment workflow. Agent 7 owns the
**actual staging deployment and end-to-end validation**. This document is the
contract: what is ready, how to run it, what "done" looks like, and how to
recover.

---

## 1. What is ready (whole pipeline recap)

| Layer | Owner | State |
|-------|-------|-------|
| Architecture / Dockerfiles | Agents 1–3 | three-container stack (PostgreSQL + FastAPI + Nginx), multi-stage images, no baked secrets |
| docker-compose (base + prod override) | Agent 4 | validated; health-gated startup; `!reset []` closes prod host ports |
| `deploy.sh` / `rollback.sh` | Agent 5 | Docker-native: checkout → build (SHA tag) → up → health poll → migrations → endpoint verify → record rollback tags; **auto-rollback** on health failure |
| `.github/workflows/deploy.yml` | Agent 6 | SSH-over-Cloudflare-Tunnel deploy; secret transport; health verify; failure artifacts; staging/production environments |

Everything needed to deploy exists. Agent 7 executes and validates.

---

## 2. Prerequisites Agent 7 must confirm BEFORE the first run

These are host/GitHub-side setup items (see `SETUP_GITHUB_SECRETS.md`):

- [ ] Repo checked out on the deploy host at `DEPLOY_PATH`
      (default `/home/deploy/wedding-dashboard`), with `production/` present.
- [ ] `deploy` user can run `docker` and the daemon is up.
- [ ] SSH public key in the host's `~deploy/.ssh/authorized_keys`;
      private key in GitHub Secret `DEPLOY_SSH_KEY`.
- [ ] Repository Secrets set: `DEPLOY_HOST`, `DEPLOY_USER`, `POSTGRES_PASSWORD`,
      `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY` (+ optional
      `DEPLOY_PORT`, `DEPLOY_PATH`, `SENTRY_DSN`).
- [ ] Repository Variable `DEPLOY_ENABLED = true`.
- [ ] GitHub Environment `staging` exists (branch `main`).
- [ ] Cloudflare Tunnel up on infra-core (.23); host reachable at
      `DEPLOY_HOST:DEPLOY_PORT`.

Quick manual connectivity check (mirrors the workflow preflight):

```bash
ssh -i <key> -p <PORT> -o BatchMode=yes deploy@<HOST> \
  'command -v docker && docker info >/dev/null && ls production/scripts/deploy.sh && echo READY'
```

---

## 3. How to execute the staging deployment

Preferred — manual dispatch (full control):

GitHub → **Actions → Deploy → Run workflow**:
- branch: `main`
- `environment`: `staging`
- `action`: `deploy`
- `revision`: leave blank (uses branch tip) unless pinning a commit

CLI:
```bash
gh workflow run Deploy -f environment=staging -f action=deploy
gh run watch
```

Automatic path: pushing to `main` runs **Tests**; on success the **Deploy**
workflow fires automatically for `staging` (because `DEPLOY_ENABLED=true`).

Watch these steps go green: Validate secrets → Configure SSH → Preflight →
Deploy via SSH → Verify deployment health → Deployment summary.

---

## 4. Success criteria

A staging deploy is successful when ALL hold:

- [ ] The `Deploy` job is **green**.
- [ ] `deploy.sh` reported all three services `healthy` within `HEALTH_TIMEOUT`
      (default 180s).
- [ ] Pending SQL migrations applied cleanly (tracked in `schema_migrations`).
- [ ] **Verify deployment health** step passed: `/health` (:3001) and
      `/healthz` (:80) on the host both returned OK (staging publishes these
      ports).
- [ ] `production/.deploy/current_image_tag` records the deployed SHA.

---

## 5. End-to-end validation (Agent 7's core job)

Beyond the workflow's own health gate, validate the app behaves:

1. **Frontend loads:** browse `https://stage-ashley-and.hazel-of-halifax.com`
   (or the host:80). The SPA renders, no console errors.
2. **API reachable through the SPA:** the frontend proxies `/api/` → backend.
   A page that lists data (e.g. guests/tasks) should populate. Direct check:
   `curl -fsS http://<host>:3001/health` → `{"status":"ok"}`-style 200.
3. **Database working:** an action that reads/writes (e.g. an RSVP submit, or a
   guest list load) succeeds and persists across a page reload — proves the
   backend↔Postgres path and that `pgdata` is durable.
4. **Auth/session:** login/session cookie issues correctly (staging uses
   non-secure cookies; that is expected without TLS termination).
5. **Migrations present:** `deploy.sh status` on the host shows healthy
   containers; spot-check that tables from `migrations/00X` exist.

The Playwright E2E suite (`production/frontend`, run by the Tests workflow with a
real backend) is the regression baseline; for staging, point it at the staging
base URL if you want a full automated pass:
```bash
cd production/frontend
VITE_API_BASE_URL=http://<host>:3001 npm run test:e2e
```

---

## 6. Rollback procedure (if validation fails)

`deploy.sh` already **auto-rolls back** within a failed deploy run (to the
previous image tag, then exits non-zero). If you notice a regression **after** a
green deploy, roll back manually:

GitHub → **Actions → Deploy → Run workflow**: `environment=staging`,
`action=rollback`.

```bash
gh workflow run Deploy -f environment=staging -f action=rollback
```

Or directly on the host:
```bash
bash production/scripts/deploy.sh rollback   # re-ups previous tag, no rebuild
```

Rollback re-ups the **previous immutable image tag** with no rebuild, so the
previous images must still exist on the host (do not prune aggressively). If the
rollback target is itself unhealthy, deploy.sh dies with a "page a human"
message — escalate; inspect `/tmp/deploy-failure.log` and
`production/logs/deploy.log`.

---

## 7. Accessing logs

- **In Actions:** the **Deploy via SSH** step streams deploy.sh's timestamped
  output; on failure download artifact `deploy-logs-staging-<run_id>`
  (`deploy.log` + `deploy-failure.log`).
- **On the host:**
  - `bash production/scripts/deploy.sh status` — tags + container health
  - `bash production/scripts/deploy.sh logs` — live compose tail
  - `cat production/logs/deploy.log` — full deploy history
  - `docker compose -f production/docker-compose.yml logs -f backend`

---

## 8. Production handover checklist (after staging is validated)

Production reuses the same workflow with `environment=production`. Before the
first production deploy:

- [ ] GitHub Environment `production` created with **required reviewers**.
- [ ] Production-specific secrets set (DISTINCT from staging):
      `DEPLOY_HOST` (client-hosting .40 / tunnel), `POSTGRES_PASSWORD`,
      `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`.
- [ ] Repo cloned on the production host at `DEPLOY_PATH`; `deploy` user +
      docker access verified.
- [ ] Traefik (external) configured to front the frontend on
      `ashley-and.hazel-of-halifax.com` and terminate TLS (prod publishes no
      host ports — see `docker-compose.prod.yml` notes/labels).
- [ ] Confirm prod runtime hardening applies: `ENVIRONMENT=production`,
      `LOG_LEVEL=WARNING`, `SESSION_COOKIE_SECURE=true` (set by the prod override).
- [ ] First production run: `gh workflow run Deploy -f environment=production -f action=deploy`,
      approve the reviewer gate, validate, keep rollback ready.

> Note: the prod **health-verify** step does NOT curl host ports (there are
> none); it relies on deploy.sh's in-stack health gate. Validate the public URL
> through Traefik instead.

---

## 9. Known edge cases handled

- Missing secret → named and the job fails before SSH.
- Tunnel/host briefly unreachable → `ssh-keyscan` retries 5×; SSH keepalives
  prevent idle drops during long builds.
- Host can't deploy (no docker / no repo) → Preflight fails fast, no secrets
  shipped.
- Deploy unhealthy → auto-rollback; job still red so you are alerted.
- Two deploys at once → serialized by `concurrency: deploy-<env>` (never
  cancelled mid-flight).
- Secret with shell metacharacters → base64 transport keeps it intact.

The pipeline is ready. Agent 7: run the staging deploy, validate E2E, then drive
the production checklist.
