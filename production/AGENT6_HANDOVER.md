# Agent 5 → Agent 6 Handover: GitHub Actions Integration

Agent 5 delivered a Docker-native `production/scripts/deploy.sh` (plus
`rollback.sh`). Agent 6 owns the GitHub Actions workflow that runs it. This
document is the contract: secrets to configure, commands to call, triggers, and
success/failure handling.

## What deploy.sh now is

- **Docker-native.** No bare-metal logic. It drives `docker compose`
  (v2 plugin; falls back to legacy `docker-compose`) using the base file for
  staging and the base + `docker-compose.prod.yml` override for production.
- **Self-contained orchestration:** git checkout → secret validation → build
  (tagged by git SHA) → down → up → health poll → migrations → endpoint verify →
  record rollback tags. Auto-rolls back on health failure.
- **Idempotent / safe:** missing secrets abort before any container starts;
  volumes are never destroyed (`down` without `-v`).

## Secrets to configure in GitHub

Add these as **repository or environment Secrets** (use GitHub *Environments*
`staging` / `production` so production can require approvals):

| Secret | Required | Notes |
|--------|----------|-------|
| `POSTGRES_PASSWORD` | yes | DB password; also embedded in backend `DATABASE_URL` by compose |
| `JWT_SECRET` | yes | `openssl rand -hex 32` |
| `API_KEY_SECRET` | yes | `openssl rand -hex 32` |
| `SESSION_SECRET_KEY` | yes | `openssl rand -hex 32` |
| `SENTRY_DSN` | optional | observability |

deploy.sh validates the four required secrets and exits 1 (naming the missing
ones) if any are unset. No `.env` file is needed in CI — export the secrets as
step env and compose reads the process environment directly. **Do not** write
secrets to a file or pass them on the command line.

## How to call it

```yaml
- name: Deploy
  working-directory: .        # deploy.sh resolves APP_DIR from its own path
  env:
    DEPLOY_ENVIRONMENT: production       # or: staging
    DEPLOY_SKIP_GIT: "1"                 # checkout already done by actions/checkout
    POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
    JWT_SECRET:        ${{ secrets.JWT_SECRET }}
    API_KEY_SECRET:    ${{ secrets.API_KEY_SECRET }}
    SESSION_SECRET_KEY: ${{ secrets.SESSION_SECRET_KEY }}
    SENTRY_DSN:        ${{ secrets.SENTRY_DSN }}
  run: bash production/scripts/deploy.sh deploy
```

- **Deploy:** `bash production/scripts/deploy.sh deploy`
- **Rollback:** `bash production/scripts/deploy.sh rollback`
  (or `bash production/scripts/rollback.sh`)
- **Status:** `bash production/scripts/deploy.sh status`

### Key env knobs

| Var | Default | Use |
|-----|---------|-----|
| `DEPLOY_ENVIRONMENT` | `production` | selects staging (base only) vs production (+override) |
| `DEPLOY_SKIP_GIT` | `0` | set `1` in CI — `actions/checkout` already placed the code |
| `DEPLOY_SKIP_BUILD` | `0` | set `1` to re-up an already-built tag |
| `IMAGE_TAG` | git short SHA | override the release tag if you tag images upstream |
| `HEALTH_TIMEOUT` | `180` | seconds to wait for full-stack health |
| `HEALTH_INTERVAL` | `5` | seconds between health polls |
| `FRONTEND_HOST_PORT` | `80` | staging frontend host port (for endpoint curl) |
| `DRY_RUN` | `0` | print commands without running them |

> Recommendation: keep `DEPLOY_SKIP_GIT=1` and let GitHub Actions do the
> checkout (`actions/checkout@v4` with the deployed ref). This keeps the git
> source of truth in the workflow, not the script.

## Triggering

- **When:** after CI tests pass on `main`. Wire deploy as a job that `needs:` the
  test job, gated `if: github.ref == 'refs/heads/main' && success()`.
- **Where it runs:** the workflow must run on a runner that can reach the
  Docker host — either a **self-hosted runner on the deploy host**, or a
  GitHub-hosted runner that SSHes in and runs `deploy.sh` there. deploy.sh needs
  a working `docker` + daemon and the repo checked out on that host.
- **Environment selection:** drive via the `DEPLOY_ENVIRONMENT` step env (and a
  matching GitHub Environment for approvals/secrets). Optionally use
  `workflow_dispatch` inputs to pick staging vs production manually.

## Success criteria

A deploy is successful only when **all three services report `healthy`** within
`HEALTH_TIMEOUT`, migrations apply cleanly, and (staging) the `/health` and
`/healthz` endpoints respond. deploy.sh exits **0** only then. Any failure path
exits **non-zero**, which fails the GitHub job.

## Failure handling

- deploy.sh **auto-rolls back** to the previous image tag if the new stack fails
  health checks (and a previous tag exists), then exits non-zero. The job will
  show as failed even though the site is restored to the prior good version.
- If there is no previous tag (first deploy) it does not roll back — it captures
  logs and fails the job for manual review.
- If the *rollback itself* is unhealthy, deploy.sh dies with a "page a human"
  message — surface this in the workflow (e.g. a notification step on failure).
- Suggested workflow safety net: add an `if: failure()` step that runs
  `bash production/scripts/deploy.sh status` and uploads the logs (below) as an
  artifact for post-mortem.

## Logging / accessing logs from Actions

- Timestamped deploy log: `production/logs/deploy.log`.
- Failure snapshot (compose ps + last 500 log lines): `/tmp/deploy-failure.log`.
- Upload both as artifacts on failure:
  ```yaml
  - name: Upload deploy logs
    if: always()
    uses: actions/upload-artifact@v4
    with:
      name: deploy-logs
      path: |
        production/logs/deploy.log
        /tmp/deploy-failure.log
      if-no-files-found: ignore
  ```
- Live tail on the host: `bash production/scripts/deploy.sh logs`.

## Rollback trigger: automatic vs manual

- **Automatic** within a single deploy run: on health failure, as above.
- **Manual** (operator-initiated, e.g. a regression noticed later): run the
  `rollback` command — ideally exposed as a `workflow_dispatch` job:
  ```yaml
  on:
    workflow_dispatch:
      inputs:
        action: { type: choice, options: [deploy, rollback] }
  ...
  run: bash production/scripts/deploy.sh ${{ inputs.action }}
  ```
  Rollback re-ups the previous immutable tag with no rebuild, so the previous
  images must still exist on the host (do not prune aggressively).

## Things Agent 6 must NOT change

- Do not switch images to `latest` for deploys — the SHA tag is what makes
  rollback work without a rebuild.
- Do not add `-v` to `down` — it would wipe `pgdata`.
- Do not "simplify" `docker-compose.prod.yml`'s `!reset []` to `ports: []`
  (host ports would leak in production).

## State / prerequisites recap for the deploy host

- Docker + compose v2 (v2.24+ for the `!reset []` tag) installed and running.
- Repo checked out (or `actions/checkout`), with `production/` present.
- `production/.deploy/` is writable (rollback state) — git-ignored.
- The four required secrets exported into the job environment.
