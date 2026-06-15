# AGENT 3 IMPLEMENTATION LOG — FRONTEND DOCKERFILE + NGINX

**Agent:** 3 (Frontend Containerization)
**Date:** 2026-06-15
**Working dir:** `C:\dev\ashley-hazel-wedding-portal-prototype\production\frontend\`
**Inputs read:** `AGENT1_ARCHITECTURE_SPECIFICATION.md`, `AGENT1_DOCKERFILE_SPECS.md` (Part B + Part C), `AGENT2_HANDOVER.md`, and the live source (`package.json`, `vite.config.ts`, `src/api/*`, backend `app/api/*`).

---

## 1. Files produced

| File | Purpose |
|---|---|
| `production/frontend/Dockerfile` | Multi-stage build: Node 20 build → nginx-unprivileged serve. |
| `production/frontend/nginx.conf` | Full nginx config: SPA serve + `/api` reverse proxy + `/healthz`. |
| `production/frontend/.dockerignore` | Trims build context (no `node_modules`, `dist`, tests, env, md). |

---

## 2. Dockerfile structure & rationale

### Stage 1 — `build` (`node:20-alpine`)
```
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci            # deterministic install from lockfile
COPY . .
RUN npm run build     # -> /app/dist
```
- **`npm ci`, not `npm install`** — reproducible install from the committed `package-lock.json`; fails if lockfile and manifest disagree.
- **Full install (NO `--omit=dev`)** — this is a deliberate correction of the orchestrator prompt's example. Vite (`vite`) and `@vitejs/plugin-react` are **devDependencies** (see `package.json`). `npm run build` runs `vite build`, so `--omit=dev` would remove Vite and the build would fail with "vite: not found". Build tools belong in the build stage regardless; nothing from `node_modules` ships to runtime.
- **Layer caching** — manifest + lockfile copied before the source so the `npm ci` layer is reused unless dependencies change.

### Stage 2 — `serve` (`nginxinc/nginx-unprivileged:1.27-alpine`)
```
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK ... wget /healthz
```
- **Non-root by default** — per Agent 1 Part B.3/B.5, the unprivileged variant runs as the `nginx` user (uid 101) and listens on the non-privileged port **8080**. No `USER root` runtime, no privileged-port capability needed.
- **Only `dist/` ships** — the final image carries nginx + static assets. No Node, no `node_modules`, no source, no secrets. A built SPA is inherently public, so there is nothing secret to leak — but the `.dockerignore` still keeps `.env*` out of the build context entirely.
- **`COPY nginx.conf`** — Agent 1 allows either a compose `:ro` mount or `COPY`. I `COPY` a full self-contained config so the image is runnable standalone; Agent 4 may still override it with a compose mount at `/etc/nginx/nginx.conf` if per-environment configs are wanted later.
- **HEALTHCHECK** — `wget -qO- http://localhost:8080/healthz` (busybox wget ships in alpine). DB-free, static 200 response, fast.

### Why multi-stage
- **Smaller final image:** Node + `node_modules` (hundreds of MB) stay in the discarded build stage. The serve image is just nginx-alpine + the static bundle. Expected nginx layer well **under 50 MB**; total runtime image ~20–45 MB (alpine nginx base ~ 20 MB + the `dist/` bundle, currently `index.html` 340 B + one ~190 KB JS asset).
- **Smaller attack surface:** no Node runtime, npm, or build toolchain in production.

---

## 3. nginx.conf — sections & logic

The config is a **full `nginx.conf`** (not a `conf.d` fragment) adapted for the non-root unprivileged image:
- **No `user` directive** — only meaningful when the master runs as root; would warn/ignore otherwise.
- **`pid /tmp/nginx.pid`** and all `*_temp_path` under `/tmp/nginx/...` — the non-root user cannot write the default `/var/run` or `/var/cache/nginx`. The Dockerfile pre-creates `/tmp/nginx` owned by `nginx`.
- **`listen 8080`** — non-privileged port.

### Reverse proxy — the critical correctness point
```nginx
upstream backend { server backend:3001; }

location /api/ {
    proxy_pass http://backend;   # NO trailing slash/path
    ...
}
```
- **`backend:3001` via Docker DNS** — service discovery on the `wedding` network, no hardcoded IP. Matches Agent 2's confirmed backend (service `backend`, internal port `3001`, unpublished).
- **NO trailing slash on `proxy_pass`** — this is a deliberate, evidence-backed deviation from Agent 1's Part B.3 example (`proxy_pass http://backend:3001/;`). With `location /api/` + a trailing slash, nginx **strips** the `/api/` prefix, so `/api/auth/login` would be forwarded as `/auth/login`. But the FastAPI routers are mounted **with** the prefix:
  - `app/api/auth.py`:    `APIRouter(prefix="/api/auth")`
  - `app/api/guests.py`:  `APIRouter(prefix="/api/guests")`
  - `app/api/invites.py`: `APIRouter(prefix="/api/invites")`
  - `app/api/tasks.py`:   `APIRouter(prefix="/api/tasks")`

  So the prefix **must be preserved**. Referencing the upstream by name with no path (`proxy_pass http://backend;`) forwards the original URI unchanged → `http://backend:3001/api/auth/login`. **A trailing slash here would 404 every backend route.** This is the single most important detail in the file; Agent 4 must not "fix" it back to a trailing slash.
- **Header forwarding** — `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` set so the backend sees the real client and scheme (it sits behind this proxy).
- **Cookie/session auth** — the SPA calls `fetch(..., { credentials: 'include' })` (see `src/api/auth.ts`). Headers (including `Cookie`) are forwarded as-is; no `proxy_cookie_*` rewriting that could break the session.
- **WebSocket-safe** — `proxy_http_version 1.1` + `Upgrade`/`Connection` via a `map $http_upgrade $connection_upgrade` so normal keep-alive isn't broken when there's no upgrade.

### SPA routing (404 → index.html)
```nginx
location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache";
}
```
- The app uses `react-router-dom`. A hard refresh / deep link to a client route (e.g. `/admin`, `/rsvp`, `/invite/:code`) hits nginx for a path with no matching file. `try_files` checks the exact file, then a directory, then **falls back to `/index.html`**, which boots React and lets the router resolve the path client-side. Without this, deep links 404.
- `index.html` is served with `no-cache` so a new deploy is picked up immediately (its referenced JS/CSS are content-hashed, so they cache safely).

### Static asset caching
```nginx
location ~* \.(js|css|png|jpg|...|woff2|map)$ {
    expires 365d;
    add_header Cache-Control "public, immutable";
}
```
- Vite fingerprints asset filenames (e.g. `index-bXETpKKN.js`), so a 1-year immutable cache is safe — a new build emits a new filename.

### Other
- **Gzip** on for text/JS/CSS/JSON/SVG/fonts, `comp_level 6`, `min_length 256`.
- **`server_tokens off`** — don't advertise the nginx version.
- **`/healthz`** — `return 200 "ok"`, `access_log off`. Used by the Docker HEALTHCHECK and available to compose/orchestrator probes.

---

## 4. Integration points with backend

| Concern | Value | Source |
|---|---|---|
| Backend service name | `backend` | Agent 2 handover §9 |
| Backend internal port | `3001` (unpublished) | Agent 2 handover §2, B.4 |
| API path contract | `/api/*` preserved end-to-end | backend `app/api/*` prefixes |
| Network | `wedding` (bridge) | Agent 1 / Agent 2 |
| Frontend → backend reach | `http://backend:3001` via Docker DNS | nginx `upstream` |
| Auth | session cookies, headers forwarded untouched | `src/api/auth.ts` |

Frontend SPA uses **relative `/api/...`** (`import.meta.env.VITE_API_BASE_URL ?? ''` → empty default), so it is **same-origin** and needs no baked API URL. No `VITE_*` build arg required.

---

## 5. Image size expectations
- nginx-unprivileged alpine base: ~20 MB.
- `dist/` payload today: `index.html` (340 B) + one JS asset (~190 KB) → negligible.
- **Total runtime image: ~20–45 MB.** The nginx layer (config + assets on top of base) is **well under 50 MB**. Node and `node_modules` are entirely confined to the discarded build stage.

---

## 6. Validation performed

| Check | Result |
|---|---|
| Multi-stage (node build + nginx serve) | PASS |
| `npm ci` (not `npm install`) | PASS |
| Build stage keeps devDeps so `vite build` works | PASS (no `--omit=dev`) |
| `/api/` → `backend:3001` (service name, no hardcoded IP) | PASS |
| `proxy_pass` preserves `/api` prefix (no trailing slash) | PASS — verified vs FastAPI router prefixes |
| SPA fallback `try_files ... /index.html` | PASS |
| Non-root nginx, listen/EXPOSE 8080 | PASS |
| pid/temp under `/tmp` (non-root writable) | PASS |
| No hardcoded secrets; `.env*` excluded from context | PASS |
| nginx.conf brace balance (9 open / 9 close) | PASS |
| `map`/`upstream`/`server` blocks well-formed | PASS |
| `.dockerignore` excludes node_modules, dist, tests, md, env | PASS |
| Live `docker build` / `nginx -t` | **NOT RUN** — Docker Desktop engine was not running in this environment. Manual structural validation done instead; Agent 4 should run a live build (see handover §7). |

---

## 7. Deviations from the orchestrator prompt (intentional, justified)

1. **Build stage uses `npm ci` WITHOUT `--omit=dev`.** Vite is a devDependency; omitting dev deps breaks `vite build`. The prompt's `--omit=dev` example would fail.
2. **Runtime image is `nginxinc/nginx-unprivileged:1.27-alpine`, listens on 8080 (not stock `nginx:alpine` on 80).** This follows **Agent 1's authoritative Part B** (non-root nginx requirement). Compose publishes host `80` (or `3000`) → container `8080`.
3. **`proxy_pass http://backend;` with NO trailing slash** (Agent 1's example had a trailing slash). Required to preserve the `/api` prefix the backend actually mounts. Strongest-evidence item in this work; verified against `app/api/*.py`.

These three changes make the image correct and production-grade; the unaltered prompt example would have produced a build that fails (deviation 1) and a proxy that 404s every API call (deviation 3).
