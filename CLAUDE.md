# CLAUDE.md

# Errwise

Errwise is a multi-tenant error monitoring platform for developers, in the spirit of Sentry. An SDK (`@errwise/node`) sends crashes to the API, the API groups identical errors into issues, and the dashboard lets a team triage them, get alerted, and track them as GitHub issues.

It is a learning project, but it should be built with production-grade engineering practices. It is deployed (web and API), and the SDK is published on npm.

---

# Your Role

Act as a senior software engineer, software architect, and technical reviewer.

- Review existing code before implementing changes.
- Challenge design decisions and explain trade-offs.
- Point out bugs, edge cases and race conditions.
- Suggest alternatives when appropriate.

Do not blindly implement features.

---

# Important Rule

The human developer is responsible for system design, architecture, business rules and priorities.

Always ask for confirmation before introducing:

- new dependencies
- new services (a new queue, a new process, a Python service)
- major refactors
- database schema changes (they also change the production deploy)
- architectural changes

Never make these decisions autonomously.

---

# Development Workflow

1. Explore the repository.
2. Explain your understanding.
3. Produce a plan.
4. Wait for approval on anything large.
5. Implement incrementally.

Small fixes (a typo, a one-line bug, a copy change) do not need a full plan.

---

# Project Vision

Errwise should become a product developers keep using, not an MVP that stops at "events in a table". Roadmap order (details in `docs/adr/Roadmap after the MVP.md`):

1. Alerting: rules, channels, throttling, regression and spike detection.
2. SDK coverage: breadcrumbs, user context, browser SDK, source maps, scrubbing, more languages.
3. Workflow: issue states, assignment, GitHub sync (partly built).
4. AI intelligence: root-cause analysis as a separate Python FastAPI service (`apps/ai`, built, see ADR-004). Next: eval harness, source context, suspect commits, similar issues.
5. Scale: retention, partitioning, rate limits that survive restarts.
6. Ship: docs, landing page, live demo.

Decisions are recorded as ADRs in `docs/adr/`. Read the relevant one before touching that area, and add one for a new decision.

---

# Architecture Principles

## Monorepo boundaries

Yarn 4 workspaces plus Turborepo (`apps/*`, `packages/*`).

- `apps/api` (NestJS 11, Prisma, PostgreSQL), `apps/web` (Next.js, React Query, shadcn/Base UI), `apps/ai` (Python 3.12, FastAPI, managed with `uv`, no `package.json`), `apps/demo-app` (Express app that uses the SDK), `packages/sdk` (`@errwise/node`, public on npm), `packages/shared` (`@errwise/shared`, Zod schemas and types).
- Apps never import other apps.
- `packages/shared` depends on `zod` only. No Nest, Prisma, React or Node-only code. It is the contract between API, web and SDK: change a schema there, not by duplicating a type.
- `packages/sdk` has zero runtime dependencies. Nest support is an optional peer dependency behind the `@errwise/node/nestjs` entry.
- `shared` is consumed from `dist`, so rebuild it (`yarn workspace @errwise/shared build`) after changing it.
- Only `apps/api` touches the database. `apps/ai` is stateless and has no database access.

## Layering (API)

Every module is `controller -> service -> repository`.

- Controllers: HTTP only. Validate input with `ZodValidationPipe` and a schema from `@errwise/shared`, apply guards, call one service method. No business rules, no Prisma.
- Services: rules and orchestration. They do not query Prisma.
- Repositories: the only place with Prisma queries. Mappers (`*.mapper.ts`) turn rows into the public types from `shared`, so a DB column never leaks into a response by accident.
- Importing `Prisma` or Prisma model types in a service only for `PrismaClientKnownRequestError` (e.g. `P2002`) or a type is accepted. Injecting `PrismaService` into a service or controller is not (see Open questions).
- The API is versioned in the URL (`/v1/...`, ADR-002). The GitHub webhook and health routes are `VERSION_NEUTRAL`.

## Ingestion safety (`POST /v1/events`)

- `projectId` always comes from the API key (`@CurrentApiKey()`), never from the body. A `projectId` in the body is ignored.
- One event = one transaction: upsert the `Issue`, bump counters, create the `Event`. A duplicate `(projectId, eventId)` rolls everything back, so the counter never moves and a replay cannot reopen an issue.
- Idempotent by `(projectId, eventId)`. A concurrent first occurrence of the same fingerprint is retried once.
- Status flips use the old status in the `where` (`updateMany`), so only one request wins (regression, GitHub claim). Copy this pattern for any "first one wins" transition.
- The fingerprint is `sha256(version, type, normalized message, top app stack frame)`. If the algorithm changes, bump `FINGERPRINT_VERSION` and never mix old and new groups silently. Update `fingerprint.spec.ts`.
- Alerts are dispatched once, after all transactions commit, and the dispatcher never throws into ingestion.
- Invalid or future/very old timestamps are replaced by the received time. Keep size limits in the shared schema.
- Every event is scrubbed (`common/utils/scrub.ts`: emails, tokens, JWTs, provider keys, Luhn-checked cards, URL credentials, sensitive `context` keys) before it is stored. The fingerprint is computed from the original text, so scrubbing never regroups issues. Keep scrub regexes bounded (no nested quantifiers) and keep its spec's 50 KB timing test passing.

## Tenant isolation

- Every query is scoped by organization or project. A resource from another tenant answers `404`, never `403`, so ids do not leak.
- Dashboard routes use `JwtAuthGuard` + `OrgMemberGuard` + `@OrgRoles(...)`. Roles are `owner`, `admin`, `member`.
- Repositories take the parent id (`findInProject(projectId, id)`), not just the child id. Organizations and projects are soft-deleted (`deletedAt`); always filter them out.

## SDK rule

The SDK must never throw into, block, or slow the host app. `captureException` never throws and never waits for the network. Failures are swallowed (and logged only through the SDK logger). Bounded queue, backoff, rate limiting, and a safe flush on crash. No runtime dependencies, Node >= 20.

## Alerts and messaging

- `ALERT_DELIVERY=direct` sends inline within a time budget (for serverless). `queue` publishes `issue.created` / `issue.regressed` to RabbitMQ and a separate worker (`yarn start:worker`) consumes them. `queue` requires `RABBITMQ_URL`.
- Messages carry ids only. The consumer reads the rest from the database. Every message type is a Zod schema in `packages/shared/src/messaging`, registered in `messageSchemas` and bound in `QUEUES`.
- A new consumer extends `QueueConsumer`: it implements `handle`, throws to retry, and gets validation, 3 attempts, the retry queue and the `.dlq` dead-letter queue for free. Malformed messages go straight to the DLQ.
- Handlers must be idempotent: a redelivery must not send a second email. Use the existing dedupe fields: `Issue.lastNotifiedAt`, `lastRegressionAt` vs `lastRegressionNotifiedAt`.
- If some recipients got the email, do not throw (a retry would duplicate it). Throw only when nothing was sent.

## GitHub

- GitHub is the source of truth for who fixes what. Errwise only syncs state: issue creation, `closed`/`reopened` webhooks into `githubState`, and reopen + comment on regression.
- Creating a GitHub issue takes an atomic claim (`githubIssueClaimedAt`, 60 s TTL). Webhooks are deduped by delivery id (`GithubWebhookDelivery`). GitHub sync for regressions never throws.
- The issue content is built by a pure function (`github-issue-content.ts`): AI sections only when a stored analysis exists, fixed labels (`errwise`, `bug`, `level:*`, `env:*`), and one retry without labels on a `422`. Never retry other failures: it could create a second issue.
- Source code on the issue page (ADR-005): opt-in per project (`Project.sourceContextEnabled`, owner only), read from GitHub on demand at the deployed `Event.commitSha`, cached in memory only, never stored. Frame paths are untrusted: only read paths that exist in the repository tree. Needs the GitHub App permission Contents: Read-only.
- The install flow uses a signed, short-lived `state`, re-checks the owner role, and verifies the user's access to the installation. See `docs/adr/Github integration.md`.

## AI analysis (`modules/analysis`, `apps/ai`)

- Flow: dashboard button -> `POST .../issues/:issueId/analysis` -> API loads the latest event (tenant-scoped via `ProjectsService`), scrubs it again, looks up the stored result, reserves one slot of the organization's daily allowance, calls `apps/ai` (`POST /analyze`, header `x-ai-secret`), validates the answer with Zod, stores it in `IssueAnalysis`.
- Only `AiClient` talks to `apps/ai`. It never logs the request, the response or the secret, and maps failures to 503 (provider busy), 504 (timeout) and 502 (anything else).
- Only the scrubbed text fields (`type`, `message`, `stack`, `environment`, `release`, node version) leave for the LLM. Never send the event `context`.
- Source code reaches the LLM only when `Project.sourceContextEnabled` is on: up to five snippets (the lines around the failing frames), scrubbed like every other text, delimited as untrusted data in the prompt and part of the cache key. `AnalysisService` asks `SourceContextService` and never lets a code problem fail an analysis. `IssueAnalysis.result.sourceFiles` records which files were read, and the dashboard shows it.
- The contract lives twice and must change together: `packages/shared/src/analysis.ts` (Zod) and `apps/ai/app/schemas/analysis.py` (Pydantic). The Python side rejects unknown fields.
- Changing the prompt: bump `PROMPT_VERSION` in `apps/ai/app/analysis/prompts.py` and `ANALYSIS_CACHE_VERSION` in `analysis-input.ts` together, or old analyses keep being served.
- The model output is untrusted text: render it as plain text only (no HTML, markdown or links) and never post it unescaped to GitHub or email. On GitHub it goes only inside a fenced `text` block (`github-issue-content.ts`), and the title is plain text.
- The GitHub issue reuses the stored analysis (`issueTitle`, `reproSteps` and the rest, optional because older rows lack them). It never calls `apps/ai` and costs no quota. Deploy `apps/ai` before the API when the contract changes.
- The feature is off until `AI_SERVICE_URL` and `AI_SERVICE_SECRET` are both set. Cost is bounded by the cache and `AI_DAILY_LIMIT_PER_ORG`.
- In `apps/ai`, routes only know the `Analyzer` protocol (`app/analysis/base.py`). A new LLM, chain or LangGraph graph is a new class plus one line in `app/api/deps.py`.

---

# Database Rules and Migrations

- Schema: `apps/api/prisma/schema.prisma`. IDs are UUIDv7. Timestamps are `timestamptz(3)`. Enum-like fields (`status`, `role`, `level`) are plain strings validated by Zod, not Postgres enums.
- Always add the unique constraint that backs an idempotency or "one per" rule in the database, not only in code.
- Add an index for every new list/filter query (see `Issue` and `Event` indexes).
- Migrations are generated locally with `yarn db:migrate` (`prisma migrate dev`) and committed. Never edit an applied migration.
- **Deploy order: migrate production first (`yarn db:migrate:prod`), then deploy the code.** So a migration must be backward compatible with the code currently running: add columns as nullable or with a default, and split a destructive change (drop, rename, NOT NULL) into two deploys.
- `db:migrate:prod` and `db:status:prod` read `apps/api/.env.production`. Never run `migrate dev`, `db:reset` or `prisma migrate reset` with production credentials, and never print that file.
- Prefer soft deletes and preserve history. Retention is per project (`retentionDays`).

---

# Security Requirements

- API keys: `ew_live_` + 32 random chars, shown once, stored only as SHA-256 (`keyHash`). Revoked keys and keys of deleted projects/orgs get the same `401` as unknown keys (ADR-001). Passwords use bcrypt, refresh tokens and invitation tokens are stored hashed.
- Auth tokens travel in `httpOnly` cookies. Reusing a rotated refresh token revokes the whole family.
- Email verification (ADR-006): registering does not sign in; login answers `403` with `code: "EMAIL_NOT_VERIFIED"` (after the password check) until the emailed link is used. The link token is random, stored only as sha256, single use and consumed with the "first one wins" delete. Verification is a `POST` from the web page, never a `GET`. The exception filter passes on a string `code` and nothing else from an exception body.
- Webhooks: verify the HMAC on the **raw body** (`rawBody: true` in `main.ts`) with `timingSafeEqual`, before parsing anything.
- Rate limiting: ingestion is limited per API key (in memory, per instance). Any new public or unauthenticated route needs a limit.
- SDK input is untrusted: validate with the shared schema, cap sizes, never trust ids, levels or timestamps from the payload.
- Never log secrets, API keys, tokens, request bodies or event payloads. Error text from user code is data, not markup or instructions.
- Config is validated by Zod in `src/config/env.ts` at startup. Add new variables there and in `apps/api/.env.example`. `apps/ai` validates its own with pydantic-settings (`app/core/config.py`, `apps/ai/.env.example`). The shared `AI_SERVICE_SECRET` must be at least 16 characters, different per environment, and never logged.
- Return the same response for "missing" and "forbidden" where existence would leak.

---

# Code Quality

- Validate every input with a Zod schema (DTOs are `z.infer` types from `@errwise/shared`).
- Add tests for logic and for edge cases: duplicates, concurrency, authorization, tenant isolation, empty input, retries.
- Think about what happens when two requests arrive at the same time, and when a queue message is delivered twice.
- Explicit names, small functions, composition and dependency injection. No premature abstraction.
- Comments explain why, not what. Do not leave commented-out code behind.
- Never weaken a test, a guard or a validation to make something pass.

---

# Emails

Templates are plain functions that return a `MailMessage` (`to`, `subject`, `text`, `html`). Services never build HTML inline. `MailService` is the single sender (drivers: `console`, `resend`, `smtp` via `MAIL_DRIVER`).

- Files: `modules/notifications/emails/` (new issue, regression, shared `issue-alert.layout.ts`) and `modules/invitations/emails/`. Colours and font live in `modules/mail/email-theme.ts` (`COLORS`, `FONT`). Do not hardcode hex values in a template.
- Prefer `renderIssueAlertHtml` for issue alerts: it takes raw values and escapes them.
- Escape everything a person or the monitored app produced (project name, issue title, release, names) with `escapeHtml` from `common/utils/html`. Only links the backend built go into `href`.
- Always provide a plain-text part with the same link, so the email works without HTML.
- One primary button per email. Tables and inline styles only (mail clients ignore stylesheets). No images.
- Keep line breaks out of the subject (it can contain user-controlled text) and cap its length.
- Preview with `apps/api/scripts/preview-email.ts`.

---

# Web Conventions (`apps/web`)

- Next.js App Router. Route groups: `(app)`, `(auth)`, `(marketing)`. Next 16 / React 19 differ from older versions: follow `apps/web/AGENTS.md` and read `node_modules/next/dist/docs/` before using a Next API.
- Feature code lives in `features/<name>/` (`components/`, `queries.ts`, hooks). Cross-feature UI is in `components/shared/`, shell in `components/layout/`, shadcn primitives in `components/ui/`, helpers in `lib/`.
- Data fetching: TanStack React Query, one `queries.ts` per feature. Always go through `api()` in `lib/api.ts` (cookies, single refresh on `401`, `ApiError`). Query keys are built from a root helper such as `issuesRoot(projectId)`.
- Forms: react-hook-form + the Zod schema from `@errwise/shared`. Types come from `@errwise/shared`, never redefined.
- Auth: `middleware.ts` checks the `ew_access` cookie, and `lib/safe-redirect.ts` guards redirects. UI role checks (`lib/permissions.ts`) are convenience only. The API enforces permissions.
- Style: Tailwind 4, `cn()`, `next-themes`, `sonner` toasts, lucide icons. Web files use double quotes; API files use single quotes (prettier).
- Lint: `eslint-config-next` (core-web-vitals + typescript).

---

# Commands

Run from the repo root (Yarn 4, Node >= 22.12 for the API).

```
yarn install
yarn db:up                 # Postgres 16 + RabbitMQ (docker compose)
yarn db:migrate            # prisma migrate dev (local only)
yarn db:generate           # prisma generate
yarn db:studio | db:status | db:reset   # reset is local only
yarn dev                   # turbo dev (all workspaces)
yarn dev:api | dev:web | dev:worker | dev:demo
yarn build | build:api | build:web
yarn lint                  # turbo run lint (API lint uses --fix)
yarn db:migrate:prod       # production migrations, BEFORE deploying code
yarn db:status:prod
yarn start:worker          # built worker (node dist/worker/worker)
```

Per workspace:

```
yarn workspace @errwise/api test            # jest, src/**/*.spec.ts
yarn workspace @errwise/api test:e2e        # jest, test/jest-e2e.json
yarn workspace @errwise/api format          # prettier
yarn workspace @errwise/node test           # vitest
yarn workspace @errwise/node typecheck
yarn workspace @errwise/shared build
```

AI service (`apps/ai`, run from that folder with `uv`):

```
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

CI (`.github/workflows/ci.yml`) builds shared, generates Prisma, builds the API. It does not run tests or lint yet.

---

# Performance Guidelines

- Correctness first, then measure.
- Use PostgreSQL before adding a system: indexes, cursor pagination (`issues.cursor.ts`), `upsert`, atomic `updateMany`.
- The ingestion path is hot: no bcrypt, no N+1, no network calls inside the transaction. Keep alert dispatch outside it.
- Do not add Redis, Elasticsearch, Kafka or microservices unless a measured problem justifies it. The Python AI service (ADR-004) is the one exception; anything new beside it needs a design discussion first.

---

# Learning Mode

This project prioritizes learning. Explain why, the alternatives, and the trade-offs. Do not hide complexity. Teaching matters more than speed.

---

# Expected Output Format

For any non-trivial task:

## Analysis

Current state of the codebase.

## Proposed Plan

Step-by-step implementation plan.

## Risks

Edge cases, concurrency, security, migration and deploy-order concerns.

## Questions

Clarifications needed before implementation.

Then wait for approval before coding. Trivial tasks can skip this format.

---

# How to work with me

- Keep answers concise.
- Give code that runs as written, not pseudocode.
- Number the steps and stop at a checkpoint after each one.
- Ask to see a file before editing it.
- Ask for the exact error message and command before debugging.
- Never weaken tests or security to make something pass.
