# GitHub Secrets & Environments — Setup Guide

Step-by-step setup for the `Deploy` workflow (`.github/workflows/deploy.yml`).
You only need to do this once per repository (plus per environment).

---

## Overview

The workflow runs on a GitHub-hosted runner, SSHes into the deploy host through
the Cloudflare Tunnel, and runs `production/scripts/deploy.sh` there. To do that
it needs: an SSH key + host coordinates, and the four app secrets that
`docker-compose` injects into the stack.

You will configure:
1. An SSH key pair (private key → GitHub Secret; public key → host `authorized_keys`).
2. Repository secrets + the `DEPLOY_ENABLED` variable.
3. Two GitHub Environments (`staging`, `production`) with environment-scoped
   secrets and protection rules.

---

## 1. Generate an SSH key for the `deploy` user

On a trusted machine (NOT committed anywhere):

```bash
ssh-keygen -t ed25519 -C "wedding-portal-deploy" -f ./wedding_deploy_key -N ""
# produces:
#   wedding_deploy_key       (PRIVATE — goes into GitHub Secret DEPLOY_SSH_KEY)
#   wedding_deploy_key.pub    (PUBLIC  — goes onto the deploy host)
```

> ed25519 is preferred (modern, compact). If your host policy mandates RSA, use
> `ssh-keygen -t rsa -b 4096`.

Install the **public** key on the deploy host for the `deploy` user:

```bash
# On the deploy host (192.168.0.32 for staging), as the deploy user:
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat wedding_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Verify from your machine (through the tunnel endpoint):

```bash
ssh -i ./wedding_deploy_key -p <DEPLOY_PORT> deploy@<DEPLOY_HOST> 'docker info >/dev/null && echo OK'
```

You should see `OK`. The `deploy` user must be able to run `docker` (in the
`docker` group) and own the repo checkout at `DEPLOY_PATH`.

---

## 2. Add repository Secrets and the kill-switch variable

GitHub → repo → **Settings → Secrets and variables → Actions**.

### Secrets tab → "New repository secret"

| Secret | Value | Notes |
|--------|-------|-------|
| `DEPLOY_SSH_KEY` | full contents of `wedding_deploy_key` (private) | include the `-----BEGIN/END-----` lines |
| `DEPLOY_HOST` | tunnel hostname/IP of the deploy host | e.g. the Cloudflare Tunnel SSH endpoint, or `192.168.0.32` if directly reachable |
| `DEPLOY_USER` | `deploy` | SSH username |
| `DEPLOY_PORT` | `22` | optional; omit to default to 22 |
| `DEPLOY_PATH` | `/home/deploy/wedding-dashboard` | optional; omit to use that default |
| `POSTGRES_PASSWORD` | strong random | `openssl rand -hex 24` |
| `JWT_SECRET` | random 32+ | `openssl rand -hex 32` |
| `API_KEY_SECRET` | random 32+ | `openssl rand -hex 32` |
| `SESSION_SECRET_KEY` | random 32+ | `openssl rand -hex 32` |
| `SENTRY_DSN` | optional | only if using Sentry |

Generate the app secrets:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "API_KEY_SECRET=$(openssl rand -hex 32)"
echo "SESSION_SECRET_KEY=$(openssl rand -hex 32)"
```

### Variables tab → "New repository variable"

| Variable | Value | Purpose |
|----------|-------|---------|
| `DEPLOY_ENABLED` | `true` | master switch. Set to anything but `true` to freeze all deploys. |

> Secrets are write-only (you can update but not read them back). Variables are
> visible — never put a secret in a variable.

---

## 3. Configure GitHub Environments

GitHub → repo → **Settings → Environments → New environment**.

### Environment: `staging`

- **Deployment branches:** Selected branches → `main`.
- **Required reviewers:** optional (staging usually auto-deploys).
- **Environment secrets** (override repo secrets for this env):
  - `DEPLOY_HOST` = staging tunnel endpoint / `192.168.0.32`
  - (optionally environment-specific `POSTGRES_PASSWORD`, etc. if staging and
    prod must differ — recommended)

### Environment: `production`

- **Deployment branches:** Selected branches → `main` (or `release/*`).
- **Required reviewers:** **YES — add at least one reviewer.** Production deploys
  then pause for manual approval in the Actions UI.
- **Environment secrets** (DIFFERENT from staging — never reuse staging creds):
  - `DEPLOY_HOST` = production / client-hosting (.40) tunnel endpoint
  - `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY` =
    fresh, distinct values
  - `SENTRY_DSN` (if used) = production DSN

Resolution rule: when the job binds to an environment, **environment secrets win
over repository secrets** of the same name. Put shared values at the repo level
and per-environment overrides at the environment level.

---

## 4. Test the deploy workflow

1. Confirm `DEPLOY_ENABLED = true`.
2. GitHub → **Actions → Deploy → Run workflow** → branch `main`,
   `environment = staging`, `action = deploy`.
3. Watch the steps:
   - **Validate deployment secrets** — should pass; if it lists missing names,
     add those secrets.
   - **Configure SSH** / **Preflight remote host** — proves connectivity + that
     the host can deploy.
   - **Deploy via SSH** — streams `deploy.sh` output.
   - **Verify deployment health** — staging curls `/health` and `/healthz`.
4. On failure, download the `deploy-logs-staging-<run_id>` artifact.

CLI equivalent:

```bash
gh workflow run Deploy -f environment=staging -f action=deploy
gh run watch
```

---

## 5. Troubleshooting SSH access

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Permission denied (publickey)` | public key not in host `authorized_keys`, or wrong `DEPLOY_USER` | re-add `.pub`, check `chmod 600 authorized_keys`, confirm user |
| `ssh-keyscan ... after 5 attempts` | tunnel/host unreachable | confirm Cloudflare Tunnel up on infra-core (.23), `DEPLOY_HOST`/`DEPLOY_PORT` correct |
| Preflight: `docker daemon not reachable` | `deploy` user not in `docker` group, or daemon down | `sudo usermod -aG docker deploy` then re-login; `systemctl start docker` |
| Preflight: `deploy.sh not found` | repo not checked out at `DEPLOY_PATH` | clone the repo to `DEPLOY_PATH` on the host (first-time host setup) |
| Hang then timeout | idle tunnel dropping the connection | already mitigated via `ServerAliveInterval`; check tunnel stability |
| `Missing required deployment secret(s): X` | secret not set (or only set at one scope) | add at repo or the bound environment |

Manual connectivity probe (mirrors the workflow):

```bash
ssh -i ./wedding_deploy_key -p <PORT> -o BatchMode=yes -o ConnectTimeout=15 \
  deploy@<HOST> 'command -v docker && docker info >/dev/null && echo HOST_OK'
```

---

## 6. Monitoring deployment status

- **Actions tab:** each run shows per-step logs + the **Deployment Summary**
  table. Green = healthy stack; red = failed (note: a red run may mean deploy.sh
  auto-rolled back to the last good version — check the logs).
- **On the host:** `bash production/scripts/deploy.sh status` (recorded image
  tags + live container health), `bash production/scripts/deploy.sh logs` (tail).
- **Failure artifacts:** `deploy.log` + `deploy-failure.log` attached to failed
  runs.

---

## 7. Security notes

- The private key lives only in `DEPLOY_SSH_KEY`; never commit `wedding_deploy_key`.
- Secrets travel to the host base64-encoded over SSH stdin/env, are decoded in
  memory, and never hit host disk or argv (see AGENT6_IMPLEMENTATION_LOG.md §4).
- Rotate secrets by updating the GitHub Secret and re-running deploy; rotate the
  SSH key by generating a new pair, updating `authorized_keys` and `DEPLOY_SSH_KEY`.
- Use **distinct** secret values for staging vs production.
