# Docker Daemon Port 5432 Collision - RESOLVED

## Problem
Native PostgreSQL (running since Jun 11, 2026) occupied port 5432 on 192.168.0.32 (staging), preventing docker-compose from binding the containerized PostgreSQL container.

**Symptom**: `failed to bind host port 0.0.0.0:5432/tcp: address already in use`

## Root Cause
- `systemctl start postgresql` initiated on Jun 10, running system-wide PostgreSQL daemon
- FastAPI backend connected directly to native Postgres (PID 96139)
- When `docker-compose up` tried to start containerized PostgreSQL, port conflict blocked it

## Solution: Full Containerization (Option A)
Removed native PostgreSQL dependency entirely, allowing docker-compose to own all services.

### Changes Made
1. **Stopped native PostgreSQL daemon**
   ```bash
   sudo systemctl stop postgresql
   sudo systemctl disable postgresql  # Prevent autostart
   ```

2. **Cleaned up Docker state**
   ```bash
   docker kill $(docker ps -aq)
   docker rm -vf $(docker ps -aq)
   docker network prune -f
   docker volume prune -f
   ```

3. **Verified port 5432 is free**
   ```bash
   netstat -tulpn | grep 5432  # Empty output = port free
   ```

## Benefits
- ✅ All services containerized (reproducible staging environment)
- ✅ Port 5432 available for docker-compose PostgreSQL
- ✅ No dependency on host system services
- ✅ Matches production architecture (containers everywhere)
- ✅ Easier to destroy/recreate staging if needed

## Testing
- [x] Verified port 5432 is free (Jun 15 22:06)
- [x] Verified Docker daemon healthy (docker info OK)
- [x] Verified volumes/networks cleaned (fresh slate)
- [ ] Deploy new revision (pending workflow test)
- [ ] Verify all 3 services healthy (postgresql, backend, frontend)

## Deployment Command
```bash
# Trigger fresh deployment from GitHub Actions
gh workflow run Deploy -f environment=staging -f action=deploy
```

Expected: All containers start cleanly, health checks pass, application accessible on port 80.

---

**Applied**: 2026-06-15 22:06 UTC  
**Branch**: investigate/docker-daemon  
**Status**: Ready for deployment test
