# SyncExc

Multi-exchange cryptocurrency trading synchronization and automation platform.

SyncExc unifies exchange connections, signal sources, AI-assisted signal interpretation, risk-controlled execution, cross-exchange synchronization, workflow automation, simulation, marketplace, referral program, developer API, community, notifications, support, and administrative governance into one operational platform.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Modules](#modules)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

## Overview

SyncExc provides a unified operational layer between cryptocurrency exchanges, trading signals, and automation. It coordinates the full lifecycle:

1. **Connect** — Connect exchanges and authorized signal sources.
2. **Discover** — Find and validate signal sources.
3. **Interpret** — Parse and structure signals deterministically and with AI assistance.
4. **Validate** — Apply deterministic validation and eligibility rules.
5. **Authorize** — Check permissions, entitlements, risk limits, and approvals.
6. **Execute** — Route approved actions to the correct exchanges.
7. **Reconcile** — Verify outcomes and handle partial failures.
8. **Monitor** — Track exposure, incidents, and operational health.

The platform is designed around strict separation of concerns:

- AI interprets but never authorizes.
- Risk controls decide but never bypass permissions.
- Notifications report state but never establish outcomes.
- Simulation runs in strict isolation from live execution.
- Every consequential action is auditable, idempotent, and reversible where safe.

## Architecture

SyncExc is a Node.js monorepo with four workspaces:

| Workspace | Purpose | Stack |
|-----------|---------|-------|
| `shared/` | Constants, schemas, validators, utilities shared by all workspaces | Node.js ESM |
| `server/` | REST API, WebSocket gateway, background workers, database | Node.js, Express, PostgreSQL, Redis |
| `client/` | User-facing web application | React, Vite, TailwindCSS |
| `admin/` | Administrator console | React, Vite, TailwindCSS |

Supporting infrastructure lives in `infrastructure/` (Terraform, Kubernetes, Nginx, monitoring).

### Data Flow
Exchange/Source → Ingestion → Normalization → Deduplication
↓
Signal Parsing ← AI Interpretation ← Message Registry
↓
Deterministic Validation → Eligibility Decision
↓
Risk Evaluation → Approval → Execution Intent
↓
Sync Engine → Exchange Adapter → Exchange
↓
Reconciliation → Notifications → Audit

text

## Modules

SyncExc implements 18 product modules:

1. **Identity and Account Security** — Registration, authentication, MFA, sessions, trusted devices, account recovery.
2. **Subscription, Billing and Entitlements** — Plans, subscriptions, payments, invoices, refunds, entitlements, usage metering.
3. **Workspaces, Teams and Permissions** — Personal and organization workspaces, roles, invitations, connection sharing.
4. **Exchange Connections and Account Management** — Exchange adapters, credentials, accounts, balances, instruments, capabilities, health.
5. **Unified Trading Terminal** — Order management, positions, trade history, execution status across exchanges.
6. **Cross-Exchange Trade Synchronization Engine** — Source event ingestion, mapping, sizing, dispatch, partial failures, reconciliation.
7. **Risk Management and Trading Safety** — Policies, pre-trade evaluation, exposure, approvals, emergency pause, circuit breakers, incidents.
8. **Signal Source Discovery, Addition and Management** — Source registry, discovery, review, validation, health, quality, sharing.
9. **AI Signal Intelligence and Processing** — Message ingestion, parsing, extraction, validation, review, intent preparation.
10. **Copy Trading and Signal Marketplace** — Providers, published signals, subscribers, copy configurations, performance.
11. **Automation Studio** — Visual workflows, triggers, schedules, templates, test runs, execution engine.
12. **Simulation, Backtesting and Replay** — Environments, backtests, replays, fill models, performance reporting.
13. **Referral and Commission System** — Attribution, commission policies, ledger, payouts, fraud detection.
14. **Developer Platform and Public API** — Applications, credentials, OAuth, webhooks, sandbox, usage analytics.
15. **Community and Collaboration** — Profiles, posts, groups, discussions, analysis, moderation, AI recommendations.
16. **Notifications and Alerts** — Event registry, templates, channels, delivery tracking, preferences, deduplication.
17. **Customer Support Portal** — Tickets, queues, escalation, diagnostics, help center, SLA tracking.
18. **Administrator Console** — Platform overview, user/workspace management, feature flags, roles, approvals, audit.

## Requirements

- **Node.js** >= 20.11.0
- **npm** >= 10.2.0
- **PostgreSQL** >= 15
- **Redis** >= 7
- **Docker** and **Docker Compose** (for local development)

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd syncexc
cp .env.example .env
npm install
2. Start the client and admin
```bash
npm run dev
```
This starts the client on http://localhost:5173 and the admin console on
http://localhost:5174. The server, database, Redis, and server environment
variables are not needed to start these frontends. Features that call the API
will not work until the server is running.

### Starting the server

The current server configuration requires `DATABASE_URL`, `REDIS_URL`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, and
`ENCRYPTION_MASTER_KEY` in `.env`. `REDIS_URL` is required by the server's
environment validation; it is not needed by the client or admin dev servers.

```bash
docker-compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev:server
```

Development
Workspace Commands
bash
npm run dev:server         # Server only
npm run dev:client         # Client only
npm run dev:admin          # Admin console only
npm run build              # Build all workspaces
npm run test               # Run all tests
npm run lint               # Lint all workspaces
npm run format             # Format all files
Database
bash
npm run db:migrate         # Run pending migrations
npm run db:seed            # Seed roles, permissions, plans
npm run db:reset           # Drop, recreate, migrate, seed (dev only)
Docker
bash
npm run docker:up          # Start all services
npm run docker:down        # Stop all services
npm run docker:logs        # Tail logs
Testing
bash
npm run test               # All tests
npm run test:server        # Server tests only
npm run test:client        # Client tests only
Server tests use Jest with an isolated test database. Client tests use Vitest with React Testing Library.

Deployment
Production deployment targets:

Server: Kubernetes (containerized Node.js)

Client/Admin: Static hosting behind CDN

Database: Managed PostgreSQL

Redis: Managed Redis

Storage: S3-compatible object storage

See docs/deployment.md and infrastructure/ for details.

Documentation
docs/architecture.md — System design and decisions

docs/modules.md — Feature inventory per module

docs/database.md — Schema, migrations, indexes

docs/deployment.md — Deployment process

docs/runbooks/ — Operational procedures

License
Proprietary. All rights reserved.

text

---

## File 10: `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: syncexc-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: syncexc
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d syncexc"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - syncexc

  redis:
    image: redis:7-alpine
    container_name: syncexc-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ""
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - syncexc

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
      target: development
    container_name: syncexc-server
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/syncexc
      REDIS_URL: redis://redis:6379
    ports:
      - "4000:4000"
    volumes:
      - ./server:/app/server
      - ./shared:/app/shared
      - server_node_modules:/app/server/node_modules
      - shared_node_modules:/app/shared/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - syncexc

  client:
    build:
      context: .
      dockerfile: client/Dockerfile
      target: development
    container_name: syncexc-client
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "5173:5173"
    volumes:
      - ./client:/app/client
      - ./shared:/app/shared
      - client_node_modules:/app/client/node_modules
      - shared_node_modules:/app/shared/node_modules
    depends_on:
      - server
    networks:
      - syncexc

  admin:
    build:
      context: .
      dockerfile: admin/Dockerfile
      target: development
    container_name: syncexc-admin
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "5174:5174"
    volumes:
      - ./admin:/app/admin
      - ./shared:/app/shared
      - admin_node_modules:/app/admin/node_modules
      - shared_node_modules:/app/shared/node_modules
    depends_on:
      - server
    networks:
      - syncexc

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  server_node_modules:
    driver: local
  client_node_modules:
    driver: local
  admin_node_modules:
    driver: local
  shared_node_modules:
    driver: local

networks:
  syncexc:
    driver: bridge