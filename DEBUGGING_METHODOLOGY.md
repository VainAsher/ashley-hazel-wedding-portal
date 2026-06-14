# Wedding Dashboard - System Debugging & Forensics Methodology

**Version:** 1.0  
**Date:** 2026-06-10  
**Status:** Established based on frontend port binding resolution  

---

## Overview

This document outlines the systematic approach used to debug and resolve the frontend port binding issue. Use this as your standard template for investigating infrastructure and application issues.

---

## The 6-Step Forensic Investigation Process

### Step 1: Problem Statement & Initial Hypothesis

**Define the Issue**
- What is broken? (Frontend unreachable from remote IP)
- What was the expected behavior? (Should work on 192.168.0.32:3000)
- What changed? (Frontend server was started)
- What's the scope? (Frontend only, backend OK)

**Initial Hypothesis**
- Network connectivity issue?
- Port binding issue?
- Server crashed?
- Firewall/network blocking?

### Step 2: System-Level Investigation

**Check Process Status**
```bash
ps aux | grep -E "vite|node" | grep -v grep
```
- Is the process running?
- What's the PID?
- How much memory/CPU?

**Check Port Binding**
```bash
ss -tlnp | grep 3000  # or netstat -tlnp | grep 3000
```
- What interface is it bound to? (`0.0.0.0` vs `127.0.0.1` vs `[::1]`)
- Is the port in use by something else?
- Is the correct process listening?

**Check Server Logs**
```bash
tail -f /tmp/frontend.log
cat /tmp/backend.log
```
- Any errors on startup?
- Any crashes reported?
- Normal operation confirmed?

### Step 3: Local Connectivity Testing

**Test from the VM itself**
```bash
curl http://localhost:3000
curl http://192.168.0.32:3000
curl http://0.0.0.0:3000
```

**Test with verbose output**
```bash
curl -v http://192.168.0.32:3000
```
- Shows where connection fails
- Shows headers and response codes
- Reveals underlying cause (refused, timeout, etc)

### Step 4: Configuration Review

**Check Relevant Configuration Files**
- `vite.config.ts` - server config (host, port, proxy)
- `fastapi main.py` - API server config
- `.env` or environment variables
- Network configuration

**Look For Common Issues**
- Hardcoded `localhost` vs `0.0.0.0`
- Wrong port numbers
- IPv4 vs IPv6 binding
- Proxy configuration conflicts

### Step 5: Root Cause Identification

**Match Symptoms to Root Cause**
```
Symptom: ERR_CONNECTION_REFUSED on remote IP
↓
Investigation: netstat shows [::1]:3000 (IPv6 localhost)
↓
Root Cause: vite.config.ts missing host: '0.0.0.0'
↓
Impact: Server only accessible from localhost
```

**Document the Chain of Causation**
- What led to the issue? (Default Vite configuration)
- Why wasn't it caught earlier? (Tested only via localhost)
- What's the systemic problem? (Lack of network binding docs)

### Step 6: Fix Implementation & Verification

**Apply the Fix**
1. Update configuration file
2. Restart service
3. Verify port binding changed
4. Test local connectivity
5. Test remote connectivity

**Verification Checklist**
- [ ] Process running? `ps aux | grep vite`
- [ ] Port binding correct? `ss -tlnp | grep 3000`
- [ ] Local curl works? `curl localhost:3000`
- [ ] Remote curl works? `curl 192.168.0.32:3000`
- [ ] Logs show network URL? Check `/tmp/frontend.log`
- [ ] No errors in logs?

---

## Applied to Frontend Issue

### What We Did

**Step 1: Problem Statement**
- Issue: Frontend refuses connection on 192.168.0.32:3000
- Expected: Should be accessible from remote IP
- Scope: Frontend only, backend works
- Hypothesis: Port binding or network config issue

**Step 2: System Investigation**
```
✅ Process running (PID 16432, node/vite)
✅ Port allocated (3000)
❌ Bound to [::1]:3000 (IPv6 localhost only)
✅ No other process on port 3000
```

**Step 3: Local Testing**
```
✅ curl localhost:3000 → HTTP 404 (expected, no index.html)
❌ curl 192.168.0.32:3000 → connection refused
→ Confirms network binding issue
```

**Step 4: Configuration Review**
```
Found: vite.config.ts missing host: '0.0.0.0'
Issue: Vite defaults to localhost binding
```

**Step 5: Root Cause**
```
Root Cause: vite.config.ts incomplete
Impact: Frontend unreachable from external IPs
Systemic: Lack of network-accessible dev server requirement
```

**Step 6: Fix & Verify**
```
✅ Added host: '0.0.0.0' to vite.config.ts
✅ Restarted frontend
✅ Verified port binding to 0.0.0.0:3000
✅ curl 192.168.0.32:3000 → HTTP 404 (correct!)
✅ Logs show "Network: http://192.168.0.32:3000/"
```

---

## Command Reference for Your Team

### Quick Diagnostics (Run These First)

```bash
# 1. Is the process running?
ps aux | grep -E "vite|python|node" | grep -v grep

# 2. What's bound to the port?
ss -tlnp | grep <PORT>    # Linux/Mac
netstat -tlnp | grep <PORT>  # Alternative

# 3. Check the logs
tail -50 /tmp/frontend.log
tail -50 /tmp/backend.log

# 4. Test locally
curl http://localhost:3000
curl http://localhost:3001/health

# 5. Test from network
curl http://192.168.0.32:3000
curl http://192.168.0.32:3001/health
```

### Deeper Investigation

```bash
# Verbose curl output
curl -v http://192.168.0.32:3000

# Check listening sockets
ss -tlnap

# Check process details
ps aux | grep vite
lsof -p <PID>

# Check file descriptors
ls -la /proc/<PID>/fd/ | grep socket

# Monitor real-time
watch -n 1 'ss -tlnp | grep 3000'
```

### Common Fixes

```bash
# Restart frontend
pkill -f "vite"
cd ~/wedding-dashboard/production/frontend
npm run dev > /tmp/frontend.log 2>&1 &

# Restart backend
pkill -f "python main.py"
cd ~/wedding-dashboard/production/backend
source venv/bin/activate
python main.py > /tmp/backend.log 2>&1 &

# Check for port conflicts
lsof -i :3000
lsof -i :3001
```

---

## Systematic Debugging Workflow

When you encounter an issue:

```
1. Reproduce the issue
   ↓
2. Narrow the scope (frontend? backend? network?)
   ↓
3. Check system state (processes, ports, resources)
   ↓
4. Review logs for errors
   ↓
5. Test connectivity (local vs remote)
   ↓
6. Review configuration files
   ↓
7. Form hypothesis (root cause)
   ↓
8. Apply fix (minimal change)
   ↓
9. Verify fix (all tests pass)
   ↓
10. Document and prevent recurrence
```

---

## Documentation Updates After Fixes

Always update documentation with:

1. **What broke?** (Specific symptom)
2. **Why did it break?** (Root cause)
3. **How was it fixed?** (Exact change)
4. **How to prevent?** (Systemic fix)
5. **What to watch for?** (Warning signs)

Example from frontend issue:
- ❌ What: ERR_CONNECTION_REFUSED on 192.168.0.32:3000
- ❌ Why: vite.config.ts missing `host: '0.0.0.0'`
- ✅ How: Added `host: '0.0.0.0'` to server config
- ✅ Prevent: Updated Ansible playbook with correct config
- ✅ Watch: Check logs for "Network: http://192.168.0.32:3000/"

---

## Debugging Checklist Template

Use this for any infrastructure issue:

```
[ ] Reproduce the issue consistently
[ ] Identify what changed recently
[ ] Check process status (ps aux)
[ ] Check port binding (ss -tlnp)
[ ] Check system resources (top, df)
[ ] Review error logs (last 50 lines)
[ ] Test local connectivity (curl localhost)
[ ] Test remote connectivity (curl <IP>)
[ ] Check configuration files
[ ] Review recent code changes (git log)
[ ] Form root cause hypothesis
[ ] Apply minimal fix
[ ] Verify fix (retest both local and remote)
[ ] Update documentation
[ ] Update Ansible/IaC if applicable
[ ] Commit changes to git
```

---

## Team Practices

### For Your Development Team

1. **Always Test Network Access**
   - Don't assume localhost = network accessible
   - Test dev servers from another machine

2. **Configure for Network Access**
   - Vite: `host: '0.0.0.0'`
   - Flask: `host='0.0.0.0'`
   - Django: `ALLOWED_HOSTS = ['*']`

3. **Log Output Should Show Network URL**
   - ✅ "Network: http://192.168.0.32:3000/"
   - ❌ "Local: http://localhost:3000/" only

4. **Document Debugging Steps**
   - Include port binding checks in runbooks
   - Document common issues
   - Build institutional knowledge

### Incident Response

When issues occur:
1. **Stay calm** - systematic approach beats guessing
2. **Document everything** - logs, commands, results
3. **Test thoroughly** - verify fix works completely
4. **Prevent recurrence** - update docs and IaC
5. **Share knowledge** - team learns from incident

---

## Tools & Commands by Scenario

### "The server won't start"
```bash
ps aux | grep -E "python|node|vite"  # Running?
tail -100 /tmp/backend.log           # Any errors?
ss -tlnp | grep 3000                 # Port conflict?
```

### "I can't connect from another machine"
```bash
ss -tlnp | grep <PORT>               # Binding to 0.0.0.0?
curl -v http://<IP>:<PORT>           # Where does it fail?
tail -50 /tmp/frontend.log           # Server logs?
```

### "The connection is slow"
```bash
top                                  # CPU/memory?
iostat                               # I/O bottleneck?
netstat -s                           # Network issues?
```

### "Port already in use"
```bash
lsof -i :<PORT>                      # What's using it?
ps aux | grep <PID>                  # Which process?
kill -9 <PID>                        # Force kill if needed
```

---

## Success Indicators

You know the fix is complete when:

✅ Process running  
✅ Port bound to `0.0.0.0:PORT` (not localhost)  
✅ Local curl works (`curl localhost:PORT`)  
✅ Remote curl works (`curl 192.168.0.32:PORT`)  
✅ Logs show no errors  
✅ Logs show network URL  
✅ Documentation updated  
✅ Fix committed to git  

---

## References

- Frontend Port Binding Fix: `FRONTEND_PORT_BINDING_FIX.md`
- Vite Documentation: https://vitejs.dev
- Socket Statistics: `man ss`
- Network Debugging: `man netstat`, `man lsof`

---

**This methodology can be applied to any infrastructure issue in your homelab or production systems.**

