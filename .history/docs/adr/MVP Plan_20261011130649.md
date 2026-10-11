# Errwise: MVP Plan

_Formerly MonitorAI. Error monitoring for developers: install the SDK, see every crash in one dashboard._

**Package manager:** Yarn 4 (workspaces). **Duration:** 28 days (about 4 weeks). **Budget:** $0 (free tiers only).

---

## 1. Goal

Build a **functional, simple, deployed** error-monitoring product, then add features on top of it.

> "Collect all my application errors in one dashboard."

The MVP is complete when a developer can:

1. Create an account, an organization, and a project.
2. Get an API key and install the SDK with one command.
3. Crash their app and see the error, grouped and counted, in the dashboard.
4. Open an issue and read its stack trace, environment, release, and context.

Why this project helps the CV: it shows an SDK, an ingestion API, multi-tenancy, a dashboard, CI/CD, and a live demo. Later phases add queues, AI analysis (Python), logs, metrics, and tracing.

## 2. Scope

### In the MVP

- Authentication (email and password, JWT)
- Organizations and memberships
- Projects and API keys (hashed)
- Event ingestion (`POST /v1/events`) with **fingerprinting into issues**
- Node SDK (`@errwise/node`) with Express and NestJS integrations
- Dashboard: issues list, issue detail, resolve and ignore
- Docker Postgres for development, CI pipeline, free deployment, live demo

### Not in the MVP (on purpose)

AI analysis, logs, metrics, tracing, alerts, releases tracking, Redis, queues (BullMQ, RabbitMQ, Kafka), Kubernetes, Grafana, Prometheus, browser SDK, source maps, billing, teams and invitations.

Rule: ideas that appear during the MVP go into `docs/ROADMAP.md`, not into the code.

## 3. User journey

1. Register, then create an organization (for example "Acme") and a project (for example "Website").
2. The platform shows an API key once (`ew_live_...`).
3. Install the SDK: `yarn add @errwise/node`.
4. Initialize it:
   ```ts
   import { Errwise } from "@errwise/node";
   Errwise.init({
     apiKey: "ew_live_...",
     environment: "production",
     release: "1.0.0",
   });
   ```
5. The app throws an error. The SDK captures it and sends it to the API.
6. The dashboard lists the issue ("TypeError: Cannot read property 'name' of undefined", 23 occurrences, last seen 2 minutes ago).
7. Clicking it shows the stack trace, environment, release, runtime context, and recent events.

## 4. Final technical decisions

| Area                  | Decision                                                           | Reason                                 |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| Monorepo              | Yarn 4 workspaces (`nodeLinker: node-modules`), optional Turborepo | Shared code and one place for CI       |
| Frontend              | Next.js, Tailwind, shadcn/ui, TanStack Query                       | Fast to build, strong CV signal        |
| Backend               | NestJS, TypeScript                                                 | Modular structure                      |
| ORM                   | Prisma 6 (pinned; upgrade to 7 later as a separate task)           | Safe, readable migrations              |
| Database (dev, CI)    | PostgreSQL 16 in Docker                                            | Free, fast, offline, resettable        |
| Database (production) | Neon free tier                                                     | Reachable from Vercel; production only |
| Hosting               | Vercel Hobby for web and API                                       | Free, zero-config NestJS               |
| SDK distribution      | npm (`@errwise` scope)                                             | Standard for packages                  |
| CI/CD                 | GitHub Actions                                                     | Free for public repos                  |
| Auth                  | JWT with argon2 password hashing                                   | Good learning, no vendor               |
| Validation            | Zod (shared) and class-validator where convenient                  | One schema for API, web, SDK           |

Free tiers change often. Re-check each provider's current limits before depending on them.

## 5. Repository structure

```
errwise/
├─ apps/
│  ├─ web/                 # Next.js dashboard
│  ├─ api/                 # NestJS API
│  │  ├─ prisma/           # schema.prisma, migrations/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ config/        # env validation (Zod)
│  │  │  ├─ database/      # PrismaModule and PrismaService
│  │  │  ├─ common/        # guards, filters, interceptors, decorators
│  │  │  └─ modules/
│  │  │     ├─ auth/ users/ organizations/ projects/ api-keys/
│  │  │     ├─ ingestion/  # POST /v1/events, API-key guard, fingerprinting
│  │  │     └─ issues/     # list, detail, status changes
│  │  └─ test/             # e2e tests
│  └─ demo-app/            # app that throws errors on demand
├─ packages/
│  ├─ sdk/                 # published as @errwise/node
│  └─ shared-types/        # Zod schemas and types shared by api, web, sdk
├─ docs/                   # architecture.md, adr/, ROADMAP.md, this plan
├─ .github/workflows/      # ci.yml, release-sdk.yml
├─ docker-compose.yml      # local Postgres
├─ .env.example
├─ .yarnrc.yml
└─ package.json
```

**Boundaries**

- Apps never import from other apps, only from `packages/*`.
- `shared-types` has no framework dependencies.
- The SDK has **no runtime dependencies**.
- Only the API touches the database.

## 6. Architecture

```
Demo app / customer app  (SDK: @errwise/node)
        │  POST /v1/events  (x-api-key)
        ▼
NestJS API ──► PostgreSQL
  │  ingestion: validate, authenticate key, fingerprint, upsert issue, store event
  │  dashboard API: auth, orgs, projects, issues
        ▲
        │  REST (JWT cookie)
Next.js dashboard
```

## 7. Data model

```
User ──< Membership >── Organization ──< Project ──< ApiKey
                                            │
                                            ├──< Issue ──< Event
                                            └──────────────< Event
```

Key rules:

- `ApiKey` stores only a **hash** and a visible **prefix**. The full key is shown once.
- `Issue` is unique per `(projectId, fingerprint)` and holds the counters.
- `Event` is unique per `(projectId, eventId)`, which makes ingestion idempotent.
- Use `context Json?` for extra SDK data, so new fields rarely need migrations.
- Use plain strings (validated in code) for `role`, `status`, and `level`.

### Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  createdAt    DateTime     @default(now())
  memberships  Membership[]
}

model Organization {
  id        String       @id @default(cuid())
  name      String
  createdAt DateTime     @default(now())
  members   Membership[]
  projects  Project[]
}

model Membership {
  userId         String
  organizationId String
  role           String       @default("member") // owner | admin | member
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@id([userId, organizationId])
}

model Project {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  platform       String       @default("node")
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  apiKeys        ApiKey[]
  issues         Issue[]
  events         Event[]
}

model ApiKey {
  id         String    @id @default(cuid())
  projectId  String
  name       String
  prefix     String
  keyHash    String    @unique
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Issue {
  id          String   @id @default(cuid())
  projectId   String
  fingerprint String
  title       String
  type        String?
  level       String   @default("error")
  status      String   @default("unresolved")
  eventCount  Int      @default(0)
  firstSeenAt DateTime
  lastSeenAt  DateTime
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  events      Event[]

  @@unique([projectId, fingerprint])
  @@index([projectId, lastSeenAt])
}

model Event {
  id          String   @id @default(cuid())
  eventId     String
  projectId   String
  issueId     String
  message     String
  stack       String?
  environment String   @default("production")
  release     String?
  timestamp   DateTime
  context     Json?
  receivedAt  DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  issue       Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)

  @@unique([projectId, eventId])
  @@index([issueId, timestamp])
  @@index([projectId, timestamp])
}
```

### Future tables (not in the MVP)

| Phase       | Tables                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| V2          | `Release`, `Invitation`, `RefreshToken`                                                                  |
| V3          | `AlertRule`, `AlertTrigger`, `NotificationChannel`                                                       |
| V4          | `AiAnalysis` (issueId, summary, cause, suggestion, model, confidence)                                    |
| Logs        | `LogEntry` (projectId, level, message, timestamp, context). High volume: plan retention and partitioning |
| Metrics     | `MetricPoint` (projectId, name, value, timestamp, tags). May move to a time-series store                 |
| Tracing     | `Trace`, `Span`                                                                                          |
| Source maps | `SourceMap`                                                                                              |
| Platform    | `AuditLog`, billing tables                                                                               |

## 8. API

### Dashboard API (JWT)

| Method    | Path                            | Purpose                                                                          |
| --------- | ------------------------------- | -------------------------------------------------------------------------------- |
| POST      | `/auth/register`, `/auth/login` | Authentication                                                                   |
| GET       | `/me`                           | Current user                                                                     |
| POST, GET | `/organizations`                | Create and list mine                                                             |
| POST, GET | `/projects`                     | Create and list (scoped to an organization)                                      |
| POST      | `/projects/:id/api-keys`        | Create a key (returned once)                                                     |
| DELETE    | `/api-keys/:id`                 | Revoke                                                                           |
| GET       | `/issues`                       | List with filters (environment, status, search), pagination, sorted by last seen |
| GET       | `/issues/:id`                   | Detail with recent events                                                        |
| PATCH     | `/issues/:id`                   | Change status (resolved, ignored)                                                |
| GET       | `/health`                       | Health check                                                                     |

### Ingestion API (API key)

`POST /v1/events` with header `x-api-key: ew_live_...`

```json
{
  "eventId": "uuid-generated-by-sdk",
  "type": "TypeError",
  "message": "Cannot read property 'name' of undefined",
  "stack": "TypeError: ...\n    at ...",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "environment": "production",
  "release": "1.0.0",
  "context": { "nodeVersion": "22.0.0", "os": "linux", "hostname": "web-1" }
}
```

Responses: `202` accepted, `400` invalid payload, `401` bad or revoked key, `413` payload too large, `429` rate limited. Accept a single event first, then arrays (batches).

### Fingerprinting rule

`fingerprint = sha256(type + normalizedMessage + topAppStackFrame)`

- `normalizedMessage`: lowercase, with numbers, UUIDs, hex values, and quoted values replaced by placeholders.
- `topAppStackFrame`: the first frame outside `node_modules`, using file path and function name (no line number, so small code edits don't split issues).
- Store each event, then upsert the issue in **one transaction**: create or update the issue, increment `eventCount`, update `lastSeenAt`.

### API key rules

- Format: `ew_live_` followed by 32 random characters. Store `sha256(key)` and the first 12 characters as `prefix`.
- Update `lastUsedAt` on use. Reject revoked keys.

## 9. SDK design (`@errwise/node`, folder `packages/sdk`)

**Public API**

- `Errwise.init({ apiKey, endpoint?, environment?, release?, enabled?, beforeSend? })`
- `Errwise.captureException(error, extra?)`
- Integrations: Express error middleware, NestJS exception filter

**Rules**

1. Never throw into the host app and never block it.
2. Short request timeout, bounded in-memory buffer (drop the oldest events when full).
3. Batch and flush on an interval, with limited retries and backoff.
4. Global handlers for `uncaughtException` and `unhandledRejection` must **flush, then exit with code 1**, preserving Node's default crash behavior.
5. `beforeSend(event)` lets users scrub sensitive data. `enabled: false` turns the SDK off.
6. Zero runtime dependencies. Build with `tsup` (ESM, CJS, types). Test with Vitest. Version with Changesets.

**Why integrations matter:** frameworks catch most errors themselves, so global handlers alone miss almost everything in Express and NestJS.

## 10. Dashboard pages

1. Login and register
2. Organizations and projects (create project, API key reveal modal, install snippet)
3. Issues list: title, count, environment, last seen, status; filters, search, pagination
4. Issue detail: stack trace, environment, release, context, recent events, resolve and ignore
5. Empty state: "Send your first error" with the install snippet

## 11. Migrations workflow

- Develop with `yarn prisma migrate dev --name <change>` against Docker Postgres only.
- Commit the generated `prisma/migrations/` files and review them in pull requests.
- CI runs `prisma migrate deploy` on an empty Postgres container, so a broken migration fails the pull request.
- Production runs `prisma migrate deploy` using `DIRECT_URL`. Never run `migrate dev` or `migrate reset` with production credentials loaded.
- Additive changes are safe. For risky changes use **expand and contract**: add the new column, backfill, switch code, drop the old column in a later release.
- Never edit an applied migration. Back up before production migrations.

## 12. Environments and configuration

| Environment      | Database                   | Notes                                             |
| ---------------- | -------------------------- | ------------------------------------------------- |
| Local            | Docker `postgres:16`       | `yarn db:up`                                      |
| CI               | Postgres service container | Fresh on every run                                |
| Preview (Vercel) | Neon `staging` branch      | Pull request deployments                          |
| Production       | Neon `main` branch         | Pooled URL for the app, direct URL for migrations |

```
DATABASE_URL="postgresql://errwise:errwise@localhost:5432/errwise"
DIRECT_URL="postgresql://errwise:errwise@localhost:5432/errwise"
JWT_SECRET="at-least-16-random-characters"
API_PORT=4000
```

Validate all environment variables at startup with Zod, and crash early if one is missing. Never commit real secrets. Use the same Postgres major version everywhere.

## 13. Deployment (free)

| Piece    | Target                                                                |
| -------- | --------------------------------------------------------------------- |
| Web      | Vercel Hobby, root directory `apps/web`                               |
| API      | Vercel Hobby, root directory `apps/api` (NestJS runs as one function) |
| Database | Neon free tier (production and staging only)                          |
| SDK      | npm, published by a GitHub Action                                     |

**Free-tier design choices**

- Cold starts are acceptable: the SDK buffers and retries.
- Use pooled connections on serverless, and a direct connection for migrations.
- Add a **retention job**: delete events older than 30 days and cap events per issue, because free databases have small storage.
- Seed demo data so the live demo always looks good.
- Provide a Dockerfile for the API and build it in CI, even though the MVP does not deploy it.
- When queues and workers arrive (V3), serverless cannot run them. Options at no cost: Postgres-based jobs with scheduled functions, or the full Docker Compose stack for demos.

**CI (every pull request)**

1. Install, lint, type-check, test, build
2. Migration check on an empty Postgres container
3. Build the API Docker image

**CD (merge to main):** `prisma migrate deploy` against production, then the Vercel deploys.

**SDK release:** Changesets opens a "Version Packages" pull request. Merging it publishes to npm using an `NPM_TOKEN` secret. Create the `@errwise` npm organization early.

## 14. Security and best practices

- API keys stored hashed, shown once, revocable.
- Passwords hashed with argon2, short-lived JWTs, httpOnly cookie in the browser.
- Every query scoped by organization or project. Write a test proving user A cannot read organization B's data.
- `helmet`, CORS restricted to your domains, per-key rate limiting, payload size limit on ingestion.
- Consistent error responses and a `/health` endpoint.
- Never log API keys or full event payloads.
- Treat input as untrusted: validate every request with Zod or class-validator.
- Conventional Commits, small pull requests, short-lived branches, an ADR for each real decision.

## 15. Testing strategy

| Level     | What                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | Fingerprinting, API key hashing and guard, SDK buffer and retry                                                                                      |
| E2E (API) | Register, login, organizations, projects, keys; ingestion (valid key creates an issue, a repeated event does not duplicate, an invalid key gets 401) |
| Tenancy   | Organization A cannot read organization B's data                                                                                                     |
| SDK       | Capture, batching, flush on shutdown, never throws, works when the API is down                                                                       |
| Smoke     | Demo app throws, error appears in the dashboard                                                                                                      |

## 16. 28-day plan

One rest or buffer day per week (days 7, 14, 21, 28). With 2-3 hours per day, stretch each week to about 10 days.

### Week 1: Foundation and backend core

| Day | Task                                                                                          | Done when                                                      |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Scaffold or clean up the monorepo, Docker Postgres, `.env.example`, README, rename to Errwise | Both apps run and the DB container is healthy                  |
| 2   | Prisma schema (7 tables), first migration, `PrismaModule`, Zod env validation                 | Tables visible in Prisma Studio, API fails fast on missing env |
| 3   | Auth: register and login (argon2, JWT), guard, `GET /me`                                      | Works in Postman                                               |
| 4   | Organizations and memberships, org-scoped guard                                               | A user only sees their organizations                           |
| 5   | Projects and API keys (hash, prefix, revoke)                                                  | Key created, validated, and revoked                            |
| 6   | E2E tests, **tenant isolation test**, CI with a Postgres service                              | CI green                                                       |
| 7   | Rest. ADR-001 (hashed API keys)                                                               |                                                                |

### Week 2: Ingestion and SDK

| Day | Task                                                                           | Done when                                                                  |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 8   | Event schema in `shared-types`, `POST /v1/events`, API-key guard               | 202 with a valid key, 401 otherwise                                        |
| 9   | Fingerprinting and issue upsert in one transaction, idempotency                | Same error twice gives one issue with count 2; duplicate `eventId` ignored |
| 10  | Ingestion hardening: size limit, per-key rate limit, batches                   | Oversized and flooded requests rejected                                    |
| 11  | SDK core: `init`, `captureException`, payload builder, transport, `tsup` build | A script creates an issue                                                  |
| 12  | SDK buffer, batching, retries, global handlers (flush then exit)               | Stopping the API never crashes the host app                                |
| 13  | Express middleware, Nest filter, `apps/demo-app`                               | A demo route creates an issue                                              |
| 14  | Rest. SDK unit tests                                                           |                                                                            |

### Week 3: Dashboard

| Day | Task                                                                                | Done when                                          |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| 15  | Web foundation: Tailwind, shadcn/ui, API client, TanStack Query, login and register | Login from the browser                             |
| 16  | Organizations and projects pages, key reveal modal, install snippet                 | Create a project and copy its key                  |
| 17  | Issues list API and page (filters, search, pagination)                              | Demo errors visible in the list                    |
| 18  | Issue detail API and page                                                           | Stack trace, environment, release, context, events |
| 19  | Resolve and ignore, relative times, empty, loading, and error states                | UI feels finished                                  |
| 20  | Polish, bug fixes, optional Playwright smoke test                                   |                                                    |
| 21  | Rest                                                                                |                                                    |

### Week 4: Ship

| Day | Task                                                                          | Done when                                           |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| 22  | API Dockerfile, production env validation, health endpoint                    | Image builds and runs locally                       |
| 23  | Deploy: Neon, two Vercel projects, env vars, `migrate deploy` in the pipeline | Live URLs work end to end                           |
| 24  | Publish the SDK to npm with Changesets, install it from npm in the demo app   | `yarn add @errwise/node` works from a clean project |
| 25  | **Dogfooding:** monitor Errwise's own API with the SDK. Seed demo data        | Your own errors appear in your dashboard            |
| 26  | README with diagram, demo GIF, quick start. `docs/architecture.md` and 3 ADRs | A stranger runs it in 5 minutes                     |
| 27  | Demo video, LinkedIn post, CV update with live links and metrics              | Errwise is on your CV                               |
| 28  | Buffer, bug fixes, start applying with the demo link                          |                                                     |

## 17. Working rules

1. No new features until day 28. Ideas go to `docs/ROADMAP.md`.
2. Commit every day with a clear message. Use pull requests so CI runs.
3. If behind, cut polish, never tests or security (hashed keys, tenant isolation, idempotency).
4. Add a technology only when you can explain the problem it solves.
5. Keep a short daily dev log: it becomes your blog post and interview stories.

## 18. Definition of done

- [ ] Live web and API URLs with a demo login and seeded data
- [ ] SDK published on npm and installable in a clean project
- [ ] CI green (lint, tests, migration check, Docker build)
- [ ] Tenant isolation, ingestion idempotency, and API key tests pass
- [ ] Errwise monitors its own API (dogfooding)
- [ ] README with architecture diagram, demo GIF, and a 5-minute quick start
- [ ] 3 ADRs written
- [ ] Added to the CV with live links and measurable bullets

## 19. Risks

| Risk               | Mitigation                                                     |
| ------------------ | -------------------------------------------------------------- |
| Scope creep        | Freeze the MVP list, use `ROADMAP.md`                          |
| SDK complexity     | Build in the order of section 9, test against a real local API |
| Free-tier limits   | Retention job, cold-start tolerant SDK, seeded demo data       |
| Migration mistakes | Docker dev database, CI migration check, expand and contract   |
| Losing momentum    | Daily commits, vertical slice working by day 13                |

## 20. After the MVP

| Version | Features                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------- |
| V2      | Releases and release comparison, better search and filters, invitations                                  |
| V3      | Alerts (email, Slack, Discord), Redis and a queue for ingestion                                          |
| V4      | **AI error analysis** as a Python FastAPI service (probable cause, suggested fix, confidence), plus logs |
| V5      | Metrics, performance monitoring, tracing (OpenTelemetry), browser SDK, source maps                       |

## 21. Commands cheat sheet (Yarn)

```bash
yarn install                              # install everything
yarn db:up                                # start local Postgres
yarn workspace @errwise/api dev           # run the API (adjust the workspace name if different)
yarn workspace @errwise/web dev           # run the dashboard
cd apps/api && yarn prisma migrate dev --name <change>
cd apps/api && yarn prisma studio
cd apps/api && yarn prisma migrate deploy  # CI and production only
```
