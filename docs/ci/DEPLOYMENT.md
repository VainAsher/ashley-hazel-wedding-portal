# Automated Deployment

A guarded GitHub Actions workflow drives a Docker-native, server-side
deployment script. This is the canonical deploy/ops reference; for one-time
setup see the cross-linked guides below.

> **Related docs**
> - [`production/SETUP_GITHUB_SECRETS.md`](../../production/SETUP_GITHUB_SECRETS.md) — SSH key, repo/environment secrets, GitHub Environments.
> - [`production/GITHUB_RUNNER_SETUP.md`](../../production/GITHUB_RUNNER_SETUP.md) — installing the self-hosted runner that executes this workflow.

## Prerequisite: self-hosted runner

The workflow is `runs-on: self-hosted`. A self-hosted GitHub Actions runner on
the internal homelab network (internal-tools VM, `.41`) executes the job and
SSHes to the deploy host — either over the internal IP `192.168.0.32` (staging)
or through the Cloudflare Tunnel. The runner never touches Docker itself; the
deploy host owns the stack, the volumes, and the rollback state. Install the
runner first (see `GITHUB_RUNNER_SETUP.md`) or deploys will queue forever with
no runner to pick them up.

## Workflow

`.github/workflows/deploy.yml`:

- **Auto-trigger:** `workflow_run` after the `Tests` workflow *completes
  successfully* on `main`, gated by the repository/environment variable
  `DEPLOY_ENABLED=true`. The guard keeps `main` green until the deploy host and
  secrets are ready.
- **Manual trigger:** `workflow_dispatch` with inputs `environment`
  (`staging` | `production`), `action` (`deploy` | `rollback`), and an optional
  `revision` (defaults to the triggering commit / branch tip).
- The job binds to a GitHub Environment (`staging` by default) so
  environment-scoped secrets and protection rules apply. Production should
  require a reviewer. A `concurrency` group prevents two deploys to the same
  environment from overlapping, and in-progress deploys are **not** cancelled.

### Job steps

1. **Checkout** (repo metadata only — the deployed code is checked out on the
   host by `deploy.sh`).
2. **Validate deployment secrets** — fails fast, naming any missing secret,
   before opening SSH.
3. **Configure SSH** — writes the key `0600` and pins the host key via
   `ssh-keyscan` (with retries) so `StrictHostKeyChecking` stays on.
4. **Preflight remote host** — confirms SSH auth, Docker, and that
   `deploy.sh` exists at `DEPLOY_PATH`.
5. **Deploy via SSH** — runs `deploy.sh` on the host (see below).
6. **Verify deployment health** — staging curls `/health`, `/health/ready`, and
   the frontend `/healthz` through the SSH session; production has no host
   ports, so it only runs `deploy.sh status`. Skipped for `rollback`.
7. **Collect remote logs on failure** — pulls `deploy.log` and
   `/tmp/deploy-failure.log` and uploads them as the
   `deploy-logs-<env>-<run_id>` artifact (14-day retention).
8. **Deployment summary** — always writes an environment/action/revision table.

### Secret transport

App secrets live in the deploy step's `env:` (GitHub masks them in logs). They
are base64-encoded into a single opaque blob, piped over **SSH stdin**, and
decoded **in memory** on the host (no temp file, never on disk, never in argv or
shell history). Each value is individually base64-encoded so shell metacharacters
in a secret cannot break remote parsing.

## Required Secrets

Configure these repository or environment secrets before enabling deployment.
Connectivity secrets:

| Name | Purpose |
| --- | --- |
| `DEPLOY_HOST` | SSH host/IP (e.g. `192.168.0.32`) or Cloudflare Tunnel endpoint. |
| `DEPLOY_USER` | SSH user on the deploy host (`deploy`). |
| `DEPLOY_SSH_KEY` | Private SSH key authorized on the host. |

App secrets injected into the Docker stack (required):

| Name | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | DB role password; reconciled into the running role each deploy. |
| `JWT_SECRET` | Backend JWT signing secret. |
| `API_KEY_SECRET` | Backend API key secret. |
| `SESSION_SECRET_KEY` | Session cookie signing key. |

Optional:

| Name | Default | Purpose |
| --- | --- | --- |
| `DEPLOY_PORT` | `22` | SSH port. |
| `SENTRY_DSN` | _(unset)_ | Enables Sentry when set (see `docs/ci/MONITORING.md`). |

`DEPLOY_PATH` is fixed by the workflow to `/home/deploy/wedding-dashboard`.

See `production/SETUP_GITHUB_SECRETS.md` for how to generate and place these,
and for the per-environment override rules.

## Server Script

`production/scripts/deploy.sh` is Docker-native (it does **not** install a
backend venv, run uvicorn directly, or rsync frontend assets — that bare-metal
path is gone). It selects `docker-compose.yml` alone for staging, and layers
`docker-compose.prod.yml` for production. The `deploy` action:

1. Reads the currently-serving image tag (the rollback target).
2. Fetches and checks out the requested revision (`DEPLOY_REVISION`).
3. Builds backend + frontend images tagged by **git short SHA** (immutable, so
   rollback can re-up a prior tag without rebuilding).
4. `compose down` then `compose up -d` — **volumes are preserved** (`pgdata`,
   `backend_logs`, `uploads_data`).
5. Polls until every service reports `healthy`, in dependency order
   `postgresql -> backend -> frontend`. On health failure it **auto-rolls back**
   to the previous image tag (and pages a human if the rollback is also
   unhealthy).
6. Reconciles the DB role password to the current `POSTGRES_PASSWORD` secret
   (Postgres only honors the password on first volume init, so a rotated secret
   must be re-applied via `ALTER USER` each deploy).
7. Applies pending numbered SQL migrations from
   `production/database/migrations`, tracked idempotently in a
   `schema_migrations` ledger table. (First-boot `schema.sql` runs via initdb
   only.)
8. Verifies endpoints — **staging only** (`/health`, `/healthz`); production
   publishes no host ports and relies on the in-stack health gate.
9. Records current/previous image tags under `production/.deploy/` for
   one-command rollback.

The default backend health check is:

```text
http://localhost:3001/health
```

## Production overlay

Production deploys add `docker-compose.prod.yml`, which:

- Closes all host-published ports (`ports: !reset []`) — the DB and backend are
  reachable only on the internal `wedding` network, and the frontend is fronted
  by **Traefik** (which terminates TLS), not a raw host port.
- Sets `ENVIRONMENT=production`, `LOG_LEVEL=WARNING`,
  `SESSION_COOKIE_SECURE=true`, and `restart: always`.

In staging the frontend host port is configurable via `FRONTEND_HOST_PORT`
(default `80`); the backend is published on `:3001` and Postgres on `:5432` for
debugging.

## Manual Server Usage

Run these on the deploy host, from the repo root (`DEPLOY_PATH`), with the
required app secrets present in `production/.env` or exported in the
environment. The default environment is `production`; pass
`DEPLOY_ENVIRONMENT=staging` for the staging stack.

Deploy the latest `main` revision (staging):

```bash
cd ~/wedding-dashboard
DEPLOY_ENVIRONMENT=staging DEPLOY_REVISION=origin/main \
  bash production/scripts/deploy.sh deploy
```

Deploy a specific revision:

```bash
DEPLOY_REVISION=5c193a1 bash production/scripts/deploy.sh deploy
```

Rollback to the previously deployed image tag:

```bash
bash production/scripts/deploy.sh rollback
```

Show recorded image tags and live container/health state:

```bash
bash production/scripts/deploy.sh status
```

Tail the running stack's compose logs:

```bash
bash production/scripts/deploy.sh logs
```

Dry-run (prints commands, changes nothing):

```bash
DRY_RUN=1 DEPLOY_REVISION=origin/main bash production/scripts/deploy.sh deploy
```

## First-time host setup

1. Install the self-hosted runner (`production/GITHUB_RUNNER_SETUP.md`).
2. Add the required secrets and `DEPLOY_ENABLED=true`
   (`production/SETUP_GITHUB_SECRETS.md`).
3. Clone the repo to `DEPLOY_PATH` (`/home/deploy/wedding-dashboard`) on the
   deploy host so `deploy.sh` is present for the preflight step.
4. Ensure the deploy user can run Docker (member of the `docker` group) and
   that `docker compose` v2.24+ is available (required for the `!reset []`
   production override).
5. Provide app secrets to the host via `production/.env` or the CI environment.
6. Merge to `main` (or dispatch manually) and verify `Tests` completes before
   `Deploy` starts.

## Rollback From GitHub

Use the `Deploy` workflow manually:

1. Select `workflow_dispatch`.
2. Choose `staging` or `production`.
3. Set `action` to `rollback`.
4. Run the workflow.

The host reads the recorded **previous image tag** (`production/.deploy/`) and
re-ups the stack on that tag, health-gating the rollback target. A red deploy
run may mean `deploy.sh` already auto-rolled back to the last good tag — check
the logs/artifact.
