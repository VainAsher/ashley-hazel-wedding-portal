# GitHub Actions Self-Hosted Runner Setup

**Status:** Converts Deploy workflow from GitHub-hosted (public internet) to self-hosted (homelab internal network)

## Why Self-Hosted Runner?

✅ Direct network access to 192.168.0.32 (staging) and future production VM  
✅ No need to expose SSH through Cloudflare Tunnel  
✅ Faster deployment (no internet latency)  
✅ More secure (never leaves homelab network)

---

## Prerequisites

- SSH access to internal-tools VM (.41, 192.168.0.41)
- Sufficient disk space (~10GB for runner + build cache)
- Docker (optional, but recommended for isolation)
- GitHub Personal Access Token with `repo` scope (see Step 1)

---

## Step 1: Generate GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **"Generate new token"**
3. Fill in:
   - **Token name:** `homelab-github-runner`
   - **Expiration:** 90 days (rotate quarterly)
   - **Scopes:** Check only `repo` (full control of private repositories)
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again)
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxx`

---

## Step 2: SSH into internal-tools (.41)

```bash
ssh deploy@192.168.0.41
# or
ssh root@192.168.0.41
```

---

## Step 3: Download and Run Setup Script

On .41, run:

```bash
# Option 1: Download the script
curl -o /tmp/setup-github-runner.sh https://raw.githubusercontent.com/VainAsher/ashley-hazel-wedding-portal/main/production/setup-github-runner.sh
chmod +x /tmp/setup-github-runner.sh

# Option 2: Copy from your local machine
scp ./production/setup-github-runner.sh deploy@192.168.0.41:/tmp/
ssh deploy@192.168.0.41 "chmod +x /tmp/setup-github-runner.sh"
```

---

## Step 4: Execute Runner Setup

On .41:

```bash
sudo /tmp/setup-github-runner.sh \
  "ghp_YOUR_TOKEN_HERE" \
  "VainAsher" \
  "ashley-hazel-wedding-portal"
```

Replace `ghp_YOUR_TOKEN_HERE` with the token from Step 1.

**Expected output:**
```
=== GitHub Actions Self-Hosted Runner Setup ===
Token: ghp_xxxx***
Repo: VainAsher/ashley-hazel-wedding-portal
Runner directory: /opt/github-runner

✓ Creating runner user: github-runner
✓ Creating runner directory: /opt/github-runner
✓ Downloading GitHub Actions runner...
✓ Extracting runner...
✓ Configuring runner...
✓ Installing systemd service...
✓ Starting runner service...

=== Setup Complete ===
✓ Runner is now registered and running as systemd service
```

---

## Step 5: Verify Runner Registration

1. Go to **GitHub Repo → Settings → Actions → Runners**
2. You should see a runner named `homelab-runner-<hostname>` with status **Idle** (green)

If it doesn't appear after 30 seconds:
```bash
# On .41:
sudo systemctl status actions-runner
sudo journalctl -u actions-runner -f  # View live logs
```

---

## Step 6: Update GitHub Secrets

Now that the runner can reach the homelab network, update **DEPLOY_HOST** secret:

```bash
gh secret set DEPLOY_HOST --body "192.168.0.32"
```

Or via GitHub UI: **Settings → Secrets and variables → Actions → DEPLOY_HOST → Edit**

---

## Step 7: Test Deployment

Trigger a test deploy:

```bash
gh workflow run Deploy -f environment=staging -f action=deploy
gh run watch
```

Or via GitHub UI:
1. **Actions → Deploy → Run workflow**
2. **Branch:** main
3. **Environment:** staging
4. **Action:** deploy
5. Click **"Run workflow"**

**Expected result:**
- Runner job executes on .41
- SSH connects to 192.168.0.32 successfully
- Deploy proceeds normally
- Workflow completes with ✅ success

---

## Maintenance

### View Runner Logs

```bash
# On .41:
sudo journalctl -u actions-runner -f  # Live logs

# Or in GitHub UI:
# Actions → workflow run → Deploy job → logs
```

### Update Runner

```bash
# On .41:
cd /opt/github-runner
sudo -u github-runner ./config.sh --check
```

### Restart Runner Service

```bash
sudo systemctl restart actions-runner
```

### Uninstall Runner

```bash
# On .41:
cd /opt/github-runner
sudo ./svc.sh uninstall github-runner
sudo rm -rf /opt/github-runner
sudo userdel -r github-runner
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Runner doesn't appear in GitHub | Check `/opt/github-runner/_diag` logs on .41 |
| `Permission denied` when running | Ensure runner user (`github-runner`) is in `docker` group: `sudo usermod -aG docker github-runner` |
| Deployment times out | Runner may be slow; increase timeouts in deploy.sh or check .41 resources |
| Runner offline after reboot | `sudo systemctl enable actions-runner` to auto-start, or manually restart |

---

## Architecture

```
GitHub Repository
        ↓
GitHub Actions workflow (Deploy)
        ↓
Self-hosted runner on .41 (internal homelab)
        ↓
SSH to 192.168.0.32:22 (staging) — direct internal network
        ↓
production/scripts/deploy.sh (Docker orchestration)
        ↓
Docker containers (PostgreSQL, Backend, Frontend)
```

**Key benefit:** All communication stays within the homelab network. No internet exposure needed for deployment.

---

## Next Steps

1. ✅ Verify runner is registered and `Idle`
2. ✅ Test deployment with `gh workflow run Deploy -f environment=staging -f action=deploy`
3. ✅ Monitor deployment logs in GitHub Actions UI
4. ⏳ Once staging deploys successfully, configure production environment + VM

---

**Questions or issues?** Check the troubleshooting table or run:
```bash
sudo systemctl status actions-runner -l
```
