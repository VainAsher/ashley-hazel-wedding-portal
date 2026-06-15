# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Wedding Portal — Frontend (React + Vite) production image
#
# Multi-stage build:
#   Stage 1 (build): Node 20 Alpine — npm ci + `vite build` → /app/dist
#   Stage 2 (serve): nginx-unprivileged (non-root) — serve dist/ + /api proxy
#
# The final image contains ONLY nginx + compiled static assets. No Node, no
# node_modules, no source, no secrets (a built SPA is fully public).
# Runtime image ~ 20-45 MB. Runs non-root, listens on 8080.
#
# Aligned with AGENT1_DOCKERFILE_SPECS.md Part B:
#   - non-root nginx via nginxinc/nginx-unprivileged
#   - listen/EXPOSE 8080 (compose publishes 80:8080)
#   - same-origin relative /api (no VITE_* build arg needed)
# ---------------------------------------------------------------------------

# ------------------------------ Stage 1: build -----------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifest + lockfile first so `npm ci` layer is cached unless deps change.
COPY package.json package-lock.json ./

# `npm ci` (NOT `npm install`) → deterministic install from package-lock.json.
# Install ALL deps including devDependencies: Vite and @vitejs/plugin-react are
# devDependencies and are REQUIRED to run the build. Do NOT pass `--omit=dev`
# here — it would strip Vite and break `npm run build`.
RUN npm ci

# Copy the rest of the source (respecting .dockerignore).
COPY . .

# Build the optimized static bundle into /app/dist.
# The SPA calls same-origin relative `/api/...` (VITE_API_BASE_URL defaults to
# ''), so no API base URL build arg is needed — nginx reverse-proxies /api.
RUN npm run build

# ------------------------------ Stage 2: serve -----------------------------
# nginx-unprivileged runs as the non-root `nginx` user (uid 101) and listens on
# 8080 by default — no root, no privileged port.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS serve

# Full nginx config (adapted for the unprivileged user: pid under /tmp,
# listen 8080, upstream backend, SPA fallback, /api proxy, /healthz).
# Copy as root, then fix permissions immediately so unprivileged nginx can read it.
COPY nginx.conf /etc/nginx/nginx.conf
RUN chmod 644 /etc/nginx/nginx.conf && chown nginx:nginx /etc/nginx/nginx.conf

# Pre-create the /tmp temp-dir parent so nginx (non-root) can create its
# leaf temp dirs there at startup. The unprivileged base already runs as the
# `nginx` user; /tmp is world-writable, so this just guarantees the parent.
USER root
RUN mkdir -p /tmp/nginx \
    && chown -R nginx:nginx /tmp/nginx
USER nginx

# Copy ONLY the compiled static assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

# Non-privileged HTTP port (compose maps host 80 -> container 8080).
EXPOSE 8080

# Liveness probe against the DB-free static health endpoint.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

# Base image's entrypoint already runs `nginx -g 'daemon off;'` as PID 1.
