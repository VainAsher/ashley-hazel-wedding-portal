# PRODUCTION READINESS CHECKLIST — Agent 7

Assessment after the real staging deployment on `192.168.0.32`.

| Item | Status | Evidence / Note |
|------|:---:|------|
| Staging deployment successful | YES | 3/3 containers built and reached `healthy`; stable for >15 min. |
| All health checks passing | YES | postgresql (pg_isready), backend (/health 200), frontend (/healthz 200). |
| Endpoint/integration E2E passing | YES | 8/8 (health, SPA, reverse proxy, DB roundtrip, persistence). |
| Playwright UI suite passing | **NO** | **37 passed / 49 failed / 2 skipped.** Failures = stale tests vs. backend auth walls (unmocked `/api/*` calls hit live backend → 401 → strict no-console-error assertion fails). Frontend test-maintenance issue, NOT a deploy defect. Must be fixed before it can gate CI. |
| Logs clean (no errors) | YES | backend/frontend clean; one transient postgres FATAL during the FIRST failed boot (config bug, since fixed) — no recurrence. |
| Rollback mechanism | PARTIAL | `deploy.sh rollback` / `rollback.sh` present and `status` verified. True image-tag rollback NOT exercised (first deploy → no previous tag exists yet). Persistence across down/up verified instead. |
| Secrets properly injected | YES | Injected at runtime via env (`.env.test`); compose uses `${VAR:?}` guards; nothing secret baked into images. **API_URL/FRONTEND_URL are REQUIRED for staging/prod** (discovered — see Troubleshooting #4). |
| Docker images optimized | YES | Multi-stage builds; frontend 74 MB (nginx + static only), backend 289 MB (slim runtime, non-root). |
| Nginx reverse proxy working | YES | `nginx -t` ok; `/api/` proxied to backend (verified via 401 path + backend logs from nginx IP). |
| Database persistence verified | YES | Marker row survived `compose down` → `up` on the `wedding-pgdata` volume. |
| Restart policy | CONFIGURED | All three `unless-stopped` (verified by inspect). NOTE: `docker kill` is treated as a manual stop and intentionally NOT auto-restarted (correct `unless-stopped` semantics). |
| **Docker installed on host** | **FIXED THIS RUN** | Was absent; installed CE 29.5.3 + compose v5.1.4. |
| **Artifacts present on host** | **FIXED THIS RUN** | Were absent; copied via scp. **Should be committed to git for prod (CI assumes checked-out tree).** |

## Ready for production: **NOT YET — conditional**

Staging deployment is functionally proven, but the following MUST be addressed before a production
cutover:

### Blockers / required before production
1. **Commit the Docker artifacts to the repo.** They currently exist on staging only via scp.
   Agent 6's GitHub Actions workflow and `deploy.sh` (git fetch/checkout) assume the compose files,
   Dockerfiles, nginx.conf and the new deploy.sh are in version control. Until then, prod deploys
   cannot be reproduced from CI.
2. **Set `API_URL` and `FRONTEND_URL` (and real secrets) in the production secret store.** Backend
   refuses to start in staging/production without them. In production they must be **HTTPS** and CORS
   origins must NOT include localhost (enforced by `config.py`).
3. **Free the canonical host ports or front with Traefik.** The bare-metal dev stack still occupies
   5432/3001/3000 on this host. Production should either stop that stack or (preferred) use the
   `docker-compose.prod.yml` override that removes direct host publishing and routes via Traefik
   (infra-core .23) — see "What's Next".
4. **Exercise a real rollback** once a second image tag exists (deploy v2, then `rollback.sh`,
   confirm v1 images re-up healthy). Not possible on a first-ever deploy.
5. **Fix the Playwright browser E2E suite.** 49/88 fail because the mocks don't cover the auth/session
   endpoints the post-security-fix backend now requires; unmocked `/api/*` calls fall through to the
   live backend and return 401, tripping the suites' strict "no console errors" teardown assertion.
   Update the mocks (or block proxy fallthrough in test mode) so the suite is green and can gate CI.

### Recommended hardening
- Pin `postgres:16-alpine` to a digest; pin base images.
- Set `SESSION_COOKIE_SECURE=true` and `SENTRY_DSN` for production.
- Add resource limits (mem/cpu) to compose services (VM has 3.9 GB RAM).
- Verify the Playwright suite is green (or quarantine known-flaky specs) in CI.
