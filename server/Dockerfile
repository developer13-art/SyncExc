# =============================================================================
# SyncExc Server — Multi-stage Dockerfile
# =============================================================================
# Build:
#   docker build -t syncexc-server -f server/Dockerfile .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base
# -----------------------------------------------------------------------------
FROM node:20.11-alpine AS base

RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# -----------------------------------------------------------------------------
# Stage 2: dependencies (all deps, for building)
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN npm install --workspace=shared --workspace=server --include-workspace-root

# -----------------------------------------------------------------------------
# Stage 3: development (used by docker-compose)
# -----------------------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules 2>/dev/null || true
COPY --from=deps /app/server/node_modules ./server/node_modules 2>/dev/null || true

COPY package.json ./
COPY shared ./shared
COPY server ./server

WORKDIR /app/server

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Stage 4: production dependencies only
# -----------------------------------------------------------------------------
FROM base AS prod-deps

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN npm install --workspace=shared --workspace=server --include-workspace-root --omit=dev \
    && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 5: production
# -----------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/shared/node_modules ./shared/node_modules 2>/dev/null || true
COPY --from=prod-deps /app/server/node_modules ./server/node_modules 2>/dev/null || true

COPY package.json ./
COPY shared ./shared
COPY server ./server

RUN addgroup -g 1001 -S syncexc \
    && adduser -S -u 1001 -G syncexc syncexc \
    && chown -R syncexc:syncexc /app

USER syncexc

WORKDIR /app/server

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]