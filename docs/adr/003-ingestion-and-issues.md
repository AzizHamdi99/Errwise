# Ingestion and Issues API

Reference for the next two steps of the MVP: the write path (ingestion) and the read/manage path (issues). Both are one flow: an error goes in, becomes an issue, and is then read and managed from the dashboard.

```
SDK  --POST /v1/events-->  Ingestion  -->  Event + Issue (PostgreSQL)
                                                    |
Dashboard  --GET/PATCH /v1/.../issues-->  Issues API
```

---

## Step 1: Ingestion

### Route

`POST /v1/events` with the header `x-api-key: ew_live_...`

Protected by `ApiKeyGuard`. The project always comes from the key (`@CurrentApiKey()`), never from the request body. If the body contains a `projectId`, it is ignored.

| Status | When                                                    |
| ------ | ------------------------------------------------------- |
| `202`  | Event accepted                                          |
| `400`  | Invalid payload                                         |
| `401`  | Missing, invalid or revoked key (same response for all) |
| `413`  | Payload too large                                       |
| `429`  | Rate limited                                            |

### Payload

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

First a single event, then arrays (batches).

### What we build

**1. Event schema** (`packages/shared/src/events.ts`)

A Zod schema shared by the API and the SDK. It enforces limits: maximum message length, stack size, context size, and the number of events in a batch.

**2. Fingerprinting**

Decides which events belong to the same issue.

```
fingerprint = sha256(type + normalizedMessage + topAppStackFrame)
```

- `normalizedMessage`: lowercase, with numbers, UUIDs, hex values and quoted values replaced by placeholders. "User 4521 not found" and "User 98 not found" produce the same message.
- `topAppStackFrame`: the first frame outside `node_modules`, using file path and function name, without the line number. A small code edit then does not split one issue into two.
- If there is no usable stack frame, fall back to type and normalized message.
- It is a pure function, so it is easy to unit test.
- `Issue.fingerprintVersion` allows changing the algorithm later without mixing old and new groups.

**3. Ingest transaction** (one transaction per event)

1. Insert the event. If `(projectId, eventId)` already exists, ignore it. This is **idempotency**: an SDK retry never creates duplicates.
2. Create the issue if the fingerprint is new. Otherwise update it: increment `eventCount`, set `lastSeenAt` and `lastRelease`.
3. Count the event only if the insert was actually new, so duplicates do not inflate the counter.

**4. Hardening**

- Body size limit (returns `413`).
- Per-key rate limit, keyed on `apiKeyId` (returns `429`).
- Timestamps in the future or far in the past are replaced by the received time.
- Stack, message and context are truncated to safe sizes.
- Never log API keys or full event payloads.

### Decisions

| Topic                           | Decision                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| New event on a `resolved` issue | Reopen to `unresolved` and clear `resolvedAt` (regression)                                      |
| New event on an `ignored` issue | Stays `ignored`                                                                                 |
| Issue `title`                   | `type: message`, truncated                                                                      |
| Rate limit store                | In memory for the MVP. Resets on restart and is per instance on serverless. Move to Redis later |
| Response body                   | Empty or `{ "id": "<eventId>" }`. The SDK never needs more                                      |

### Module structure

```
modules/ingestion/
├─ ingestion.module.ts
├─ ingestion.controller.ts
├─ ingestion.service.ts
├─ ingestion.repository.ts
├─ fingerprint.ts            # pure functions: normalize + fingerprint
└─ rate-limit.guard.ts
```

### Tests

- Valid key creates an issue.
- The same error twice gives one issue with count 2.
- A duplicate `eventId` is ignored and the count does not change.
- An invalid or revoked key gets `401`.
- An oversized payload gets `413`.
- A resolved issue is reopened by a new event.
- Unit tests for normalization and fingerprinting (numbers, UUIDs, quoted values, `node_modules` frames, missing stack).

---

## Step 2: Issues API

### Routes

All routes sit under the project, so `OrgMemberGuard` and the project lookup scope every query by tenant.

| Method | Path                                                           | Purpose                   |
| ------ | -------------------------------------------------------------- | ------------------------- |
| GET    | `/v1/organizations/:orgId/projects/:projectId/issues`          | List                      |
| GET    | `/v1/organizations/:orgId/projects/:projectId/issues/:issueId` | Detail with recent events |
| PATCH  | `/v1/organizations/:orgId/projects/:projectId/issues/:issueId` | Change status             |

### What we build

**1. List**

- Filters: `status`, `environment`, search on `title`.
- Sorted by `lastSeenAt`, newest first.
- **Cursor pagination**, because the list changes while the user browses it, and offset pagination would skip or repeat rows.
- The index `(projectId, status, lastSeenAt desc)` is made for this query.

**2. Detail**

- The issue: title, type, level, status, `eventCount`, first and last seen, first and last release.
- The latest N events with stack trace, environment, release and context.
- A separate `.../issues/:id/events` endpoint for older events can come later.

**3. Status changes**

`PATCH` with `status` set to `unresolved`, `resolved` or `ignored`.

- `resolved` sets `resolvedAt`. Going back to `unresolved` clears it.
- Any member can change status, since it is daily work and not administration. Restrict to owner and admin if preferred.

### Module structure

```
modules/issues/
├─ issues.module.ts
├─ issues.controller.ts
├─ issues.service.ts
├─ issues.repository.ts
└─ issues.mapper.ts
```

Shared types (`@errwise/shared`): `listIssuesQuerySchema`, `updateIssueSchema`, `PublicIssue`, `PublicEvent`, `IssueDetail`, `Paginated<T>`.

### Tests

- Filters and pagination return the right rows and a stable order.
- A member can read. A non-member gets `404`.
- An issue from another project or organization gets `404` (tenant isolation).
- Status changes persist, and `resolvedAt` is set and cleared correctly.
- An issue reopened by ingestion shows as `unresolved` in the list.

---

## Result

After both steps, an event sent with `curl` and an API key appears as an issue in the list, with its count, and its detail shows the stack trace. The SDK and the dashboard then plug into something that already works.

## Order of work

1. Event schema and the fingerprinting function, with unit tests.
2. Ingest service, transaction and controller.
3. Size limit and rate limit.
4. Issues repository, service and controller.
5. Tests for both, including tenant isolation.
