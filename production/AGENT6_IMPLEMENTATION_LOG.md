# Agent 6 — GitHub Actions Integration: Implementation Log

Owner: Agent 6 (GitHub Actions Integration)
Date: 2026-06-15
Artifact under management: `.github/workflows/deploy.yml`

This log documents the deployment workflow that drives Agent 5's Docker-native
`production/scripts/deploy.sh` from GitHub Actions, over an SSH connection that
reaches the deploy host through the Cloudflare Tunnel terminating on infra-core
(.23).

---

## 1. Deployment model (why SSH, not a self-hosted runner)

`deploy.sh` must run **on the deploy host** because it drives `docker compose`
(build / up / down / health-poll / migrations) against the host's Docker daemon
and reads/writes the host's rollback-tag state in `production/.deploy/`.

A GitHub-hosted `ubuntu-22.04` runner therefore **SSHes into the host** and runs
`deploy.sh` there. The runner never touches Docker. This keeps the runner
stateless and the durable stack/volumes/rollback state entirely on the host.

```
GitHub Actions runner ──SSH──▶ Cloudflare Tunnel (infra-core .23) ──▶ deploy host
                                                                       (192.168.0.32 staging
                                                                        / client-hosting .40 prod)
```

The host key is pinned with `ssh-keyscan` (with retry) so `StrictHostKeyChecking`
stays effective; we do not blindly accept host keys.

---

## 2. Trigger conditions

Two entry points, both gated by the `DEPLOY_ENABLED` repo/environment **variable**
being `'true'` (a kill switch — set it to anything else to freeze all deploys):

| Trigger | Fires when | Environment | Action |
|---------|-----------|-------------|--------|
| `workflow_run` (Tests completed, branch `main`) | only if `github.event.workflow_run.conclusion == 'success'` | `staging` (default) | `deploy` |
| `workflow_dispatch` (manual) | operator clicks Run | chosen input (`staging`/`production`) | chosen input (`deploy`/`rollback`) |

The job-level `if:` enforces: `DEPLOY_ENABLED == 'true' && (manual OR upstream tests passed)`.

So an automatic deploy happens **only after the Tests workflow passes on main**,
never on a red test run. Manual dispatch can target either environment and run
either deploy or rollback.

Concurrency group `deploy-<environment>` with `cancel-in-progress: false`
serializes deploys per environment and never interrupts an in-flight rollout
(interrupting deploy.sh mid-`up` could leave a half-applied stack).

---

## 3. Revision selection

`DEPLOY_REVISION` resolves to, in order:
`inputs.revision` (manual override) → `github.event.workflow_run.head_sha`
(the exact commit Tests validated) → `github.sha`.

The runner checks out this ref for metadata, and `deploy.sh` performs the
authoritative `git fetch origin main && git checkout --force $DEPLOY_REVISION`
**on the host**, so the deployed code matches the tested commit exactly. (We do
NOT set `DEPLOY_SKIP_GIT`, so deploy.sh owns the host checkout.)

---

## 4. Secret injection via SSH (the secure part)

Secrets are referenced as GitHub Secrets in the runner step `env:` (GitHub masks
them in logs). They must reach the **remote** process environment without ever
appearing in:

- the remote process argv (`ps` on the host would leak them),
- the remote shell history,
- disk in plaintext.

Mechanism used:

1. On the runner, each secret VALUE is `base64`-encoded and emitted as a line
   `NAME <base64>`. The whole set is `base64`-encoded again into one opaque
   `blob` token.
2. The blob is passed to the remote as `env WD_SECRET_BLOB="$blob" ... bash -seu`
   feeding a **single-quoted** heredoc (`<<'REMOTE_DEPLOY'`) — so the runner does
   NOT expand the remote script, and the only data crossing is the opaque blob.
3. On the host, the script decodes the blob in memory and `export`s each
   `NAME=$(base64 -d <value>)`. No temp file, nothing on disk, nothing in argv.

Encoding every value in base64 means a secret containing quotes, `$`, `=`,
spaces, or newlines cannot break the remote parsing — verified locally with a
password like `p@ss'w$rd "x"=1`.

`deploy.sh` then re-validates the four required secrets
(`POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`) and
`docker compose` reads them from the process environment via `${VAR:?}` guards.
`SENTRY_DSN` is optional and only forwarded when set.

---

## 5. Cloudflare Tunnel connectivity

- The SSH endpoint (`DEPLOY_HOST` / `DEPLOY_PORT`) is the tunnel-exposed address
  of the deploy host. SSH options used: `BatchMode=yes` (never prompt),
  `ConnectTimeout`, and `ServerAliveInterval=30` / `ServerAliveCountMax=10` so a
  long build/health-wait does not drop on an idle tunnel.
- `ssh-keyscan` is retried up to 5× (5s apart) to tolerate a transient tunnel
  blip during host-key pinning.
- A dedicated **Preflight** step authenticates and asserts `docker` is installed,
  the daemon is reachable, and the repo + `deploy.sh` exist at `DEPLOY_PATH`
  **before** any secret is shipped — fail fast, fail cheap.

---

## 6. Error handling & rollback

Defense in depth, fail-fast at each layer:

1. **Validate deployment secrets** step: lists every missing secret and exits 1
   before opening SSH.
2. **Preflight** step: aborts if the host can't deploy (no docker / no repo).
3. **deploy.sh** (on host): validates secrets again; on health-check failure it
   **auto-rolls back** to the previous immutable image tag and exits non-zero
   (which fails the SSH command → fails the job). If there is no previous tag
   (first deploy) it captures logs and fails for manual review. If the rollback
   itself is unhealthy it dies with a "page a human" message.
4. **Verify deployment health** step (skipped for `rollback`): runs
   `deploy.sh status` and, on staging, curls `/health` (:3001) and `/healthz`
   (:80) on the host. Production publishes no host ports, so it relies on
   deploy.sh's in-stack health gate.
5. **Manual rollback**: `workflow_dispatch` with `action: rollback` runs
   `deploy.sh rollback`, which re-ups the previous tag (no rebuild).

The job fails (red) whenever any step exits non-zero — including the case where
deploy.sh successfully auto-rolled back, so an operator is always alerted even
when the site was restored.

---

## 7. Logging & artifacts

- `deploy.sh` writes a timestamped log to `production/logs/deploy.log` and a
  failure snapshot (`compose ps` + last 500 log lines) to `/tmp/deploy-failure.log`.
- On `failure()`, the **Collect remote logs** step `cat`s both off the host into
  `./deploy-artifacts/` (best-effort; never fails the step), and **Upload
  deployment logs** publishes them as artifact
  `deploy-logs-<env>-<run_id>` (14-day retention).
- The **Deployment summary** step (`if: always()`) writes a table
  (environment, action, revision, host, trigger, status, timestamp) to
  `$GITHUB_STEP_SUMMARY`.

---

## 8. Environment separation (staging vs production)

`environment: ${{ inputs.environment || 'staging' }}` binds the job to a GitHub
**Environment**, which provides:

- environment-scoped secrets that **override** repo secrets (so staging and
  production can use different `DEPLOY_HOST`, `POSTGRES_PASSWORD`, JWT/API/SESSION
  secrets, etc.),
- protection rules — **production should require reviewers** so a human approves
  before any production deploy proceeds,
- deployment-branch restriction (`main` only).

`deploy.sh` internally selects the compose files from `DEPLOY_ENVIRONMENT`:
staging = `docker-compose.yml`; production = base + `docker-compose.prod.yml`
(closes host ports, hardens runtime, Traefik-fronted).

---

## 9. How to manually trigger a deploy

GitHub UI → **Actions** → **Deploy** → **Run workflow**:
- pick branch `main`,
- `environment`: `staging` or `production`,
- `action`: `deploy` or `rollback`,
- `revision`: optional (defaults to branch tip).

CLI:
```bash
gh workflow run Deploy -f environment=staging -f action=deploy
# rollback production:
gh workflow run Deploy -f environment=production -f action=rollback
```

(Production runs pause for required-reviewer approval if configured.)

---

## 10. How to view logs

- **Live, in Actions:** open the run → the **Deploy via SSH** step streams
  deploy.sh's timestamped output; **Deployment summary** shows the outcome table.
- **On failure:** download the `deploy-logs-<env>-<run_id>` artifact
  (`deploy.log` + `deploy-failure.log`).
- **On the host:** `bash production/scripts/deploy.sh logs` (live tail),
  `bash production/scripts/deploy.sh status` (tags + container health),
  `cat production/logs/deploy.log`.

---

## 11. Validation performed

- `deploy.yml` parses as valid YAML (Python `yaml.safe_load`).
- Secret-transport roundtrip tested locally end-to-end (emit → base64 → `env`
  → remote `bash -seu` decode), including a value containing `' " $ = space`.
  All values reconstructed byte-for-byte; empty optional secret omitted cleanly.
- Conditional logic reviewed: auto-deploy only on `workflow_run` success + main +
  `DEPLOY_ENABLED == 'true'`; manual dispatch bypasses the test gate but still
  honors `DEPLOY_ENABLED`.
- Artifact upload path (`./deploy-artifacts`) is populated by the preceding
  collect step under `if: failure()`.

---

## 12. Required GitHub configuration (summary; full guide in SETUP_GITHUB_SECRETS.md)

Repository (or environment) **Secrets**:
`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT` (opt),
`DEPLOY_PATH` (opt), `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`,
`SESSION_SECRET_KEY`, `SENTRY_DSN` (opt).

Repository **Variable**: `DEPLOY_ENABLED=true`.

GitHub **Environments**: `staging` (branch `main`), `production` (branch `main`,
**required reviewers**, distinct secret values).
