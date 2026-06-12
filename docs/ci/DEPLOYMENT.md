# Automated Deployment

Week 2 Task 008 adds a guarded GitHub Actions deployment workflow and a
server-side deployment script.

## Workflow

`.github/workflows/deploy.yml` runs after the `Tests` workflow succeeds on
`main`. It can also be started manually with `workflow_dispatch` for staging,
production, explicit revisions, and rollback.

Automatic deployment is guarded by the repository variable:

```text
DEPLOY_ENABLED=true
```

The guard keeps the main branch green until the deployment server secrets are
installed.

## Required Secrets

Configure these repository or environment secrets before enabling deployment:

| Name | Purpose |
| --- | --- |
| `DEPLOY_HOST` | SSH host or IP address. |
| `DEPLOY_USER` | SSH user on the deployment server. |
| `DEPLOY_SSH_KEY` | Private SSH key with access to the server. |

Optional secrets:

| Name | Default | Purpose |
| --- | --- | --- |
| `DEPLOY_PORT` | `22` | SSH port. |
| `DEPLOY_PATH` | `/home/deploy/wedding-dashboard` | Repository path on the server. |

## Server Script

`production/scripts/deploy.sh` runs on the server. It:

1. Fetches and checks out the requested revision.
2. Installs backend dependencies in `production/backend/venv`.
3. Applies every SQL migration in `production/database/migrations`.
4. Restarts the backend process.
5. Builds the frontend with `npm ci` and `npm run build`.
6. Optionally syncs frontend assets when `FRONTEND_DEPLOY_DIR` is set.
7. Runs backend and optional frontend health checks.
8. Records the previous revision for rollback.

The default backend health check is:

```text
http://127.0.0.1:3001/api/guests
```

## Manual Server Usage

Deploy the latest `main` revision:

```bash
cd ~/wedding-dashboard
DEPLOY_REVISION=origin/main production/scripts/deploy.sh deploy
```

Deploy a specific revision:

```bash
cd ~/wedding-dashboard
DEPLOY_REVISION=5c193a1 production/scripts/deploy.sh deploy
```

Rollback to the previous deployed revision:

```bash
cd ~/wedding-dashboard
production/scripts/deploy.sh rollback
```

Show deployment status and run health checks:

```bash
cd ~/wedding-dashboard
production/scripts/deploy.sh status
```

Dry-run without changing the server:

```bash
cd ~/wedding-dashboard
DRY_RUN=1 DEPLOY_REVISION=origin/main production/scripts/deploy.sh deploy
```

## GitHub Actions Setup

1. Add the required secrets.
2. Confirm the server can clone and fetch the GitHub repository.
3. Confirm `production/backend/.env` exists on the server and contains
   `DATABASE_URL`.
4. Confirm PostgreSQL client tools, Python 3, Node, npm, and rsync are installed.
5. Set repository variable `DEPLOY_ENABLED=true`.
6. Merge to `main` and verify that `Tests` completes before `Deploy` starts.

## Rollback From GitHub

Use the `Deploy` workflow manually:

1. Select `workflow_dispatch`.
2. Choose `staging` or `production`.
3. Set `action` to `rollback`.
4. Run the workflow.

The server reads `.deploy/previous_revision` and redeploys that revision.
