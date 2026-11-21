# Issue list performance

How we measure the issue list (`GET /v1/organizations/:orgId/projects/:projectId/issues`) and what we found.
Rule: **measure, change, measure again.** Every perf change below is compared with this baseline.

## How to reproduce

Local database only (`yarn db:up`). Both scripts refuse to run when `DATABASE_URL` is not `localhost`, and they never print it.

```
yarn workspace @errwise/api exec tsx scripts/perf/seed-perf.ts      # about 1 minute, safe to run again
yarn workspace @errwise/api exec tsx scripts/perf/explain-perf.ts   # scan nodes only
yarn workspace @errwise/api exec tsx scripts/perf/explain-perf.ts deep --plan   # one case, full plan
```

The seed deletes and recreates only the `perf-org` organization, so other local data is not touched.
`explain-perf.ts` writes the SQL by hand, in the same shape Prisma generates (checked with the `query` log event). If `IssuesRepository.list` changes, update the SQL there too.

## Dataset

| What | Value |
|---|---|
| Issues | 50 000 (70% unresolved, 20% resolved, 10% ignored) |
| Events | 999 950: 5 "hot" issues with 100 000 events, every other issue has 10 |
| Ties | 500 issues share the same `lastSeenAt` (exercises the `id` tie-breaker of the cursor) |
| Environments | production ~70%, development ~29%, staging ~1%, `canary` on 3 issues only (a rare value) |
| Search terms | `timeout` in about 17% of titles (common), `zxqrare` in 5 titles (rare) |

## Baseline (before any change)

Milliseconds on a laptop vary a lot between runs (the deep page measured 7 to 23 ms), so the **plan shape and buffers** matter more than the exact time.

| Case | Execution | Plan | Verdict |
|---|---|---|---|
| default list, page 1 | 0.1 to 0.2 ms | Index scan + incremental sort | fine |
| page 2 (cursor) | 0.1 to 0.2 ms | same | fine |
| **deep page** (cursor 20 000 rows in) | 7 to 23 ms | Index scan, cursor is a `Filter`, **20 001 rows removed, 19 832 buffers** | cost grows with depth → ISSUE-1 |
| **status = all** | 25 to 51 ms | Seq Scan on all 50 000 issues + top-N sort | grows with table size → ISSUE-5 |
| env = staging (common) | 2 to 3 ms | Index scan + probe per issue | fine |
| **env = canary (rare)** | 80 to 109 ms | Parallel Seq Scan on 1M events | → ISSUE-3 |
| search = timeout (common) | 0.3 to 0.9 ms | stops after the first 26 matches | fine |
| **search = zxqrare (rare)** | 35 to 70 ms | Seq Scan on all issues (`ILIKE '%x%'`) | → ISSUE-4 |
| environmentsByIssue, normal page | 0.2 to 0.5 ms | Bitmap scan on the events of 25 issues | fine |
| **environmentsByIssue, page with hot issues** | **218 to 269 ms** | Seq Scan on 500 000 events | on every list and detail request, polled every 20 s → ISSUE-3 |

## Findings and what they change in the plan

1. **ISSUE-3 is the most valuable fix.** One hot issue makes every list refresh read all of its events just to learn which environments it has. It is also the fix for the rare-environment filter.
2. **ISSUE-1 is real but only for deep pages.** Pages 1 and 2 are already fast because Postgres sorts the few rows that share a `lastSeenAt` (Incremental Sort). The `OR` cursor is not an index bound, so the cost is proportional to how far you scroll. Worth fixing, but it matters less than ISSUE-3.
3. **ISSUE-4** only hurts for rare terms. A common term stops early. Trigram index still worth it, because users search for specific words.
4. **ISSUE-5 is justified by the data**: `status = all` scans the whole table and sorts it. It grows linearly with the number of issues.
5. ISSUE-2 (polling every loaded page) is a web-side problem and does not show up in SQL timings.

## After each change

Append a section here: what changed, the new numbers for the affected rows, and the plan node that changed.

## ISSUE-1: cursor predicate and index (done; the cursor condition was refined in ISSUE-6)

**Change**
- Index `(projectId, status, lastSeenAt desc)` became `(projectId, status, lastSeenAt desc, id desc)`. The migration creates the new index first, then drops the old one.
- The cursor condition now also contains `lastSeenAt <= cursor.lastSeenAt`. It is redundant logically, but it is a plain range, so the index scan can start at the cursor. The `OR` after it only checks the rows that share that exact timestamp.

**Result** (same dataset, same cases)

| Case | Before | After |
|---|---|---|
| page 1 / page 2 | 0.1 to 0.2 ms, Index Scan + Incremental Sort | ~0.09 ms, Index Scan only (the sort node is gone) |
| deep page (20 000 rows in) | 7 to 23 ms, `lastSeenAt` only in `Filter`, **20 001 rows removed, 19 832 buffers** | ~0.1 to 0.2 ms, `lastSeenAt <= …` in `Index Cond`, **1 row removed, 29 buffers** |

The deep page now costs the same as page 1: it no longer depends on how far the user scrolled. Buffers are the number to trust (they do not move with machine load, milliseconds do).

**Correctness**
- `scripts/perf/verify-pagination.ts` pages through all 50 000 issues with the real repository and encoded cursors, at limits 7 and 25, for each status. Each walk matches one full ordered query exactly: no duplicate, no skipped row, same order. 500 issues share one `lastSeenAt`, so page boundaries fall inside ties.
- Unit tests: `issues.cursor.spec.ts`, `issues.repository.spec.ts` (pins the `lte` bound), `issues.service.spec.ts`.

**Not changed by this issue:** `status = all`, environment filter on a rare value, rare search and `environmentsByIssue` (ISSUE-3, 4, 5).

## ISSUE-2: polling reloaded every loaded page (done)

**Problem.** TanStack Query refetches an infinite query by looping over all loaded pages, one request after another (`infiniteQueryBehavior.ts`: `do { fetchPage } while (currentPage < remainingPages)`; each page needs the cursor of the fresh previous one, so they cannot run in parallel). The list polled every 20 s, so a tab with 10 loaded pages sent 10 sequential requests per tick, each one also running the `environmentsByIssue` query.

**Change.** `features/issues/polling.ts`: `issuesPollInterval(loadedPages)` returns 20 s for one page and `false` for more. The list stays fresh with several pages through the app's other triggers: window focus (`staleTime` is 30 s) and the refetch after a status change.

**Measured** with the real `@tanstack/query-core` (5.104.5) and fake timers, counting requests in one 20 s tick:

| Loaded pages | Before | After |
|---|---|---|
| 1 | 1 | 1 |
| 5 | 5 | 0 |

**Trade-off.** Once the user has clicked "Load more", new errors no longer appear on their own until the tab regains focus, a status changes or the page reloads. A "new issues available" banner driven by a one-row poll would fix that without the cost; not built yet.

**Left out on purpose**
- *Dedupe by id when flattening pages* (in the first plan). With the current order (`lastSeenAt desc`) a row's key only ever increases, so it can only move toward page 1, never appear twice. It becomes necessary if a sort can move rows both ways, so it moves to ISSUE-6.
- *Status change refetches every loaded page*: `useUpdateIssueStatus` calls `invalidateQueries`, so pressing `r` with 5 pages loaded costs 5 requests. The proper fix is to patch the cached pages with the PATCH response; it is shared with bulk actions, so it goes into ISSUE-9.

## ISSUE-3: environments from a summary table, not from the events (done)

**Problem.** `environmentsByIssue` grouped ALL events of the page's issues on every list and detail request (polled every 20 s), and the environment filter probed `Event` issue by issue. One hot issue with 100 000 events made a page cost 200+ ms; a rare environment cost 80+ ms.

**Change**
- New table `IssueEnvironment(issueId, projectId, environment, firstSeenAt)`, primary key `(issueId, environment)`, index `(projectId, environment)`. Migration `20261121115652_issue_environments` creates it and backfills it from `Event` in one transaction. No existing row is modified.
- Ingestion: after `tx.event.create`, one `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`) in the same transaction. A duplicate `eventId` fails at `event.create`, so the transaction rolls back before this runs.
- `IssuesRepository.environmentsByIssue(projectId, ids)` reads the summary (sorted, scoped by project). The environment filter is `environments: { some: { projectId, environment } }`.

**Measured** (same dataset)

| Case | Before | After |
|---|---|---|
| environmentsByIssue, normal page | 0.2 to 0.5 ms | 0.1 to 0.25 ms |
| environmentsByIssue, page with the 5 hot issues | **218 to 269 ms** (Seq Scan, 500 000 events) | **0.1 to 0.26 ms** (Bitmap Index Scan on the primary key, 55 rows) |
| list, env = canary (rare) | **80 to 354 ms** (Parallel Seq Scan on 1M events) | **0.13 ms** (index on `(projectId, environment)`, 3 rows) |
| list, env = staging | 2 to 3 ms | 0.9 ms |

**Cost on the hot path.** One more statement per ingested event. Locally the whole `store()` transaction takes about 12.4 ms per event, and the statement alone about 2.3 ms (one extra round trip), so about +19%. On Neon the round trip is slower than on localhost; measure it after the deploy. If it matters, the event insert and the environment insert can be merged into one statement.

**Correctness checks** (`scripts/perf/verify-issue-environments.ts`, real database)
- a new issue records its environment; the same environment twice leaves one row;
- a replayed `eventId` is rejected, the counter does not move and its environment is NOT left behind (rolled back);
- 10 parallel events bringing the same new environment to an existing issue: no error, one row;
- 10 parallel first occurrences of a new fingerprint: one issue, 10 events, one row;
- the summary equals the distinct environments of the events.
Unit tests: `ingestion.repository.spec.ts` (order of writes, rollback on duplicate, failure propagates), `issues.repository.spec.ts`, `issues.service.spec.ts`.

### Production deploy checklist (order matters)
1. Optional safety net: create a Neon branch (snapshot) of the production database.
2. `yarn db:migrate:prod`. Creates and fills the table. The running code ignores it, so this is safe.
3. Deploy the API (ingestion now writes the table, reads use it).
4. **Run the backfill once more.** Events ingested between step 2 and step 3 by the old code have no row. It is idempotent:
   ```sql
   INSERT INTO "IssueEnvironment" ("issueId", "projectId", "environment", "firstSeenAt")
   SELECT e."issueId", e."projectId", e."environment", min(e."timestamp")
   FROM "Event" e GROUP BY e."issueId", e."projectId", e."environment"
   ON CONFLICT DO NOTHING;
   ```
5. Check that nothing is missing (the result must be 0):
   ```sql
   SELECT count(*) FROM (SELECT DISTINCT "issueId", environment FROM "Event") ev
   LEFT JOIN "IssueEnvironment" ie USING ("issueId", environment) WHERE ie."issueId" IS NULL;
   ```
Rollback: revert the code. The table can stay (it is only a summary) or be dropped; `Event` is untouched.

**Known limits**
- There is no retention job yet. When one deletes old events, it must also remove environments that no longer have events, or the summary will list an environment that has none.
- `firstSeenAt` is approximate (see the schema comment) and nothing reads it yet.

## ISSUE-4: title search (done)

### Bug fixed first: `%` and `_` were wildcards
Prisma's `contains` builds `%term%` and does not escape the term. On the perf data, searching `%` returned all 50 000 issues and `time_ut` returned the 8 333 issues titled "timeout". Users search for things like `100%` or `user_id`, so this was a correctness bug, and `%%%` also forced a full scan.
`escapeLike()` (`common/utils/like.ts`) now escapes `\`, `%` and `_` before the term reaches `contains`. Checked on the real database with titles that literally contain `%`, `_` and `\`: `%` matches only the title with a `%`, `time_ut` matches nothing, `100%`, `user_id` and `C:\temp` match their own titles, case-insensitive search still works.

### Index
Migration `20261121120840_issue_title_trigram`: `CREATE EXTENSION IF NOT EXISTS pg_trgm` and a GIN index `Issue_title_trgm_idx` (`gin_trgm_ops`) on `Issue.title`, declared in `schema.prisma` so Prisma does not report drift. If the production role cannot create the extension, the migration fails as a whole and nothing is applied.

| Case | Before | After |
|---|---|---|
| search = zxqrare (rare) | 25 to 70 ms, Seq Scan on all issues | **0.05 ms**, Bitmap Index Scan on the trigram index |
| search = zxqrare, status = all | 25 to 45 ms, Seq Scan | 0.05 ms |
| search = timeout (common) | 0.2 to 0.9 ms | 0.27 ms (the planner still prefers the ordering index and stops after 26 matches) |

Index size: 5.6 MB for 50 000 titles (the table is 22 MB).

### The cost: write amplification on the hot path
Every ingested event updates its `Issue` row (`eventCount`, then `lastSeenAt`, which is indexed, so the update is not HOT). Each non-HOT update writes a new entry in every index, and a GIN index writes one per trigram of the title (about 70 for a 72-character title).

| | Result |
|---|---|
| Ingestion, whole `store()` transaction (`bench-ingest.ts`, 300 events x 3 rounds) | baseline median 8.25 ms; with the index 7.72 and 7.93 ms: no measurable change locally |
| Trigram index growth after about 1 800 updates of ONE issue | 5.6 MB -> 8.0 MB (+43%); the btree ordering index grew +6% |
| After `VACUUM "Issue"` | does not shrink (8.4 MB) but the space is reused: 600 more updates left it at 8.4 MB, so growth is bounded by the updates between two vacuums |

That is roughly 1.3 KB of index churn per event. It does not change latency at this scale, but it means more WAL and more index to vacuum on a crash loop of one issue.

**Decision (owner): keep the GIN index on `Issue.title`.** Revisit, and move to an immutable `IssueSearch(issueId, title)` table (trigram index written once when the issue is created), if after deploying you see any of: ingestion latency rising with event volume, `Issue_title_trgm_idx` much larger than the table, or autovacuum on `Issue` that cannot keep up. Check with:
```sql
SELECT pg_size_pretty(pg_relation_size('"Issue_title_trgm_idx"'::regclass)) AS trgm,
       pg_size_pretty(pg_relation_size('"Issue"'::regclass)) AS tbl;
SELECT n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'Issue';
```

### Limits
- Trigram indexes need at least 3 characters. A 1 or 2 character search still works but cannot use the index (it is a scan, as before). The shared schema allows 1 character; I left that contract unchanged.
- Re-measure ingestion with `scripts/perf/bench-ingest.ts` after every new index on `Issue` (ISSUE-5 and ISSUE-6 add some).

### Production deploy
`yarn db:migrate:prod` first (it creates the extension and builds the index; a plain `CREATE INDEX` blocks writes to `Issue` while it builds, milliseconds at current size), then deploy. The `escapeLike` fix is code only and does not depend on the migration.

## ISSUE-5: the "All" status tab (done)

**Problem.** With no status filter, the list cannot use `(projectId, status, lastSeenAt, id)`: Postgres scanned all issues of the project and sorted them (Seq Scan + top-N heapsort, 21 to 51 ms at 50 000 issues, growing linearly with the table).

**Change.** Migration `20261121121411_issue_list_all_statuses_index`: index `(projectId, lastSeenAt desc, id desc)`, the same order without the status.

| Case | Before | After |
|---|---|---|
| status = all, page 1 | 21 to 51 ms, Seq Scan + Sort | **0.05 ms**, Index Scan, no Sort node |
| status = all, deep page (cursor 30 000 rows in) | 14 to 23 ms | **0.06 ms** |

**Checks.** `verify-pagination.ts` now also walks the "all" case at page sizes 7 and 25: 50 000 of 50 000 rows, no duplicate, no skip, same order as one full query (the 500 tied rows fall inside page boundaries). Ingestion with all three Issue indexes of this work in place: medians 7.20 and 7.31 ms per event (baseline 8.25 ms), no regression. The new index is 3 MB for 50 000 issues.

**Alternative measured and rejected: three per-status queries merged in the app.** Status has only three values and each already has an ordered index, so no new index would be needed. Through the real repository: 2.9 ms median (3.7 ms on a deep page) against about 2.5 ms for one single-status query, so reads are equivalent. It was rejected because it costs three connections per request (the Neon pooler is limited), needs merge logic per sort, and saves only about 3 MB of index and a write per event that measured as noise. Revisit it only if ingestion latency on `Issue` becomes a problem (see ISSUE-4).

**Limit.** ISSUE-6 adds sorts by first seen and by event count. Those sorts combined with the "All" tab will not have their own index (they would be a scan and sort, about 20 ms at 50 000 issues). That combination is rare and I did not add two more indexes for it.

### Where the backlog stands
Performance work (ISSUE-0 to 5) is done. The `Issue` table now has 6 indexes (primary key, fingerprint, GitHub number, status + order, all-status order, title trigram). Every further index needs a `bench-ingest.ts` run first.
Next: ISSUE-6 (sorting), 7 (filters and facets), 8 (24 h sparkline per row), 9 (bulk actions).

## ISSUE-6: sorting (done)

**Feature.** The list can be sorted by last seen (default), first seen and most events: `?sort=lastSeen|firstSeen|events` in the API (validated by the shared Zod schema, a closed set mapped to a column in `SORT_FIELD`, never user input) and in the dashboard URL. Every sort is "column desc, then id desc". The cursor names its sort (`sort|value|id`), so a cursor made for another sort is a 400 instead of pointing at the wrong place; dates must be strict ISO and the event count a 32-bit integer.
Rows can only move toward the top (`lastSeenAt` and `eventCount` only grow, `firstSeenAt` never changes), so a cursor can never show a row twice and the web needs no dedupe (the ISSUE-2 note that expected one here was wrong).

### The ISSUE-1 cursor condition was not enough, and was replaced
ISSUE-1 added `value <= cursor` next to the `OR`. That works while ties are small, but the event count has HUGE tie groups (in this data 49 995 issues share one count; in real data most issues are seen once or twice). Inside a tie group the `lte` starts at the first row of the group and the `id` condition (in the `OR`) discards rows until the cursor: the deep page of "most events" took **11.5 ms** while the same depth under the other sorts took 0.06 ms.
Now a page after a cursor is two exact index ranges (`IssuesRepository.list`): (1) the rows tied with the cursor value and a smaller id, (2) only if the page is not full, the rows with a smaller value. Everything stays in typed Prisma (a row comparison would need raw SQL).

| Deep page (20 000 rows in) | Before | After |
|---|---|---|
| sort=events | 11.5 ms (scan of the tie group) | 0.06 + 0.03 ms |
| sort=lastSeen / firstSeen | 0.06 to 0.13 ms | 0.07 + 0.06 to 0.13 ms |

The price is one more cheap query on pages after the first (the "tied" range usually returns nothing). Page 1 is still a single query.

### Indexes and what they cost (decision for the owner at review)
Migration `20261121122125_issue_list_sort_indexes`: `(projectId, status, firstSeenAt desc, id desc)` and `(projectId, status, eventCount desc, id desc)`. Page 1 and deep pages of both sorts: 0.04 to 0.08 ms, Index Scan, no Sort.

The `eventCount` index has a cost the others do not: `eventCount` changes on every event, so its update could be a HOT update (cheap, in place) and is not any more.

| | Without the eventCount index | With it |
|---|---|---|
| HOT share of `Issue` updates (`pg_stat_user_tables`) | 50% (1 of the 2 updates per event) | **0%** |
| WAL per ingested event (`pg_wal_lsn_diff`, 301 events) | 6.4 to 6.9 KB | **8.9 to 10.2 KB (+40 to 50%)** |
| `store()` latency per event | median 8.0 to 8.2 ms | median 6.6 to 7.0 ms (no slowdown; noise) |

So latency is unchanged locally, but every event writes about 45% more WAL and an extra entry in every `Issue` index, trigram index included. Both are paid at any scale. The benefit is that "most events" does not scan the project's issues (without the index: about 15 to 20 ms at 50 000 issues, 1 to 2 ms at a few thousand). The dashboard does not depend on the index, so it can be dropped (`DROP INDEX "Issue_projectId_status_eventCount_id_idx"`) and the sort still works.
**Mitigation not done (touches the ingestion hot path, needs a decision):** the ingestion does two updates of the issue row per event (`eventCount` in the upsert, then `lastSeenAt` in `updateMany`). One raw `UPDATE ... SET eventCount = eventCount + 1, lastSeenAt = GREATEST(...)` would make it one row version per event, which halves the index churn compared to now.

### Verification
- `verify-pagination.ts` walks 3 sorts x 4 statuses (incl. All) x 2 page sizes = 24 walks over the 50 000 issues, each against one full ordered query: all 24 equal (no duplicate, no skipped row, same order), including the 49 995-row tie group of `events`.
- Unit tests: cursor (each sort, cross-sort rejection, strict parsing, int4 bounds), repository (two ranges, a full tied page stops after one query, tied rows come first, filters and project scope in both ranges), service (cursor for another sort is a 400 before querying, the next cursor holds the sort value).

### Limits
- "First seen" and "Most events" combined with the **All** tab have no index (they scan and sort): about 17 ms per page at 50 000 issues (`verify-pagination.ts` shows the walk of `firstSeen` + All taking 34 s over 2 000 pages). The default tab is Unresolved, so this is a rare path.
- A cursor from before this change (no sort in it) is rejected with a 400; the dashboard drops it on reload.

## ISSUE-7: filters and facets (done)

**Feature.** New list filters, all combinable with the status, environment, search and sort (`?level=`, `?release=`, `?regressed=true`, `?age=24h|7d` in the API and in the dashboard URL):
- `level`: fatal, error, warning, info.
- `release`: the release the issue was **first seen in** ("introduced in"), not the latest one.
- `regressed`: only issues that came back after being resolved. `regressed=false` is "no condition", not "never regressed".
- `age`: "new issues", first seen within the last 24 hours or 7 days.
- `GET /v1/organizations/:orgId/projects/:projectId/issues/facets` returns `{ environments, releases }` (at most 20 each: environments by number of issues, releases newest first). The dashboard fills its dropdowns with it, which replaces the hardcoded `production / staging / development` list. Same tenant rule as every route: another organization's project is a 404 and reads nothing.

**A bug avoided on the way.** The cursor conditions were spread next to the filters (`{ ...where, [column]: ... }`). With sort "first seen" plus the "new issues" filter, both are about `firstSeenAt`, so the cursor condition would have replaced the age condition and page 2 would have shown issues older than the window. They now go in an `AND`, and there is a unit test and a real-database check for it (`age` with all three sorts).

### Measured before writing the code (50 000 issues, no new index)

| Case | Execution | Plan |
|---|---|---|
| level = warning (10% of unresolved) | 0.26 ms | ordering index, stops after 26 matches |
| level = fatal (no unresolved issue is fatal: worst case) | 15.9 ms | ordering index, reads all 35 000 unresolved |
| release = common (5%) | 0.34 ms | ordering index |
| release = rare (50 issues, or 1) | 5.3 to 5.6 ms | Seq Scan |
| regressed (1%) | 0.73 ms | ordering index |
| age = 24h / 7d | 0.08 ms | first-seen index / ordering index |
| regressed + level + release | 5.6 ms | Seq Scan |
| facets: environments | 9.6 ms | index-only scan of 103 000 `IssueEnvironment` entries |
| facets: releases | 11.3 ms | Seq Scan of 50 000 issues |

**Decision: the `(projectId, firstRelease)` index from the original plan is NOT added.** The rare-release filter costs 5.5 ms at 50 000 issues (about 0.5 ms at 5 000), and the index would add an entry to every event's update for as long as the project exists (see the WAL numbers in ISSUE-6). Add it if rare-release filtering becomes slow in real use. No `level` index either (four values, never selective); `regressed` is 1% and already fast. Because no index was added, `bench-ingest.ts` was not re-run.

**Facets cost.** They read every row of the project, so they grow linearly with it (about 10 ms each at 50 000 issues, maybe 100 ms at 500 000). The dashboard asks once per project view and keeps the answer for 5 minutes (`staleTime`), outside the `issuesRoot` query key so a status change does not refetch it; it is never polled. If it ever hurts, the two options are a short in-memory cache per project on the API, or a small table of known environments and releases kept by the ingestion.

### Verification
- `verify-filters.ts` (new): every filter and several combinations, walked page by page with the real repository and cursors, compared with a hand-written SQL query: all equal, including 22 rows for `regressed + level + release`, `age` with each of the three sorts (2 208 rows at 7 days), the rare release (1 row), `level=fatal` (0 rows unresolved, 5 000 over all statuses) and the facets (also against a second project: an unknown project gets empty facets, no leak).
- Unit tests: each filter maps to its column, `regressed=false` adds nothing, `age` uses the right window (fake timers), the age filter survives the cursor, the facets are scoped by project and capped, a null release is never returned, the service passes every filter and `facets` is a 404 for another organization.
- `seed-perf.ts` now also creates 500 regressed issues and the releases `v2.0-beta` (50 issues) and `v9.9-rare` (1 issue). The current local data was updated with the same shape by a one-off SQL update (random picks), so it does not need a re-seed.

### Limits
- `age` is measured from the time of each request, so a long scroll in "new in 24 hours" can lose a row that just crossed the 24-hour line between two pages. Acceptable for a "what is new" view.
- The facets show at most 20 releases; a release in the URL that is not among them is still shown and applied.

## ISSUE-8: 24-hour trend on each row (done)

**Feature.** Each issue in the list shows its last 24 hours as hourly columns. The list items now carry `trend24h`: exactly 24 numbers (`TREND_HOURS`), oldest first, in UTC hours; the last value is the current hour, which is not over yet. The detail and the status update do not carry it (shared type `IssueListItem`).

**How.** One grouped query for the whole page, not one per issue (`IssuesRepository.hourlyCounts`: `date_trunc('hour', "timestamp", 'UTC')`, `GROUP BY issueId, hour`, scoped by project, every value bound). The service runs it in parallel with the environments lookup (`Promise.all`) and zero-fills the sparse rows (`issue-trend.ts`, pure and tested): an issue with no recent event gets 24 zeros, never `undefined`. No schema change and no new index.

### Cost (this is the part to watch)
The query reads the events of the page's issues inside the window, through the existing `(issueId, timestamp)` index. Its cost follows **how many events those issues had in the last 24 hours**, not their history.

| Case | Execution |
|---|---|
| a normal page (25 issues, 10 events each) | 0.16 ms |
| one issue with 100 000 events in the last 24 h (a crash loop) | **53 ms** (Bitmap Heap Scan of 100 000 rows) |
| the 5 hot issues with a 30-day window (500 000 events, scaling check) | 345 ms |

Rule of thumb: about 0.5 to 0.7 ms per 1 000 events in the window. The list refreshes every 20 s per open tab while one page is loaded, so a crash-loop issue on the page costs that on every refresh of every viewer. It is fine at the volumes of a free-tier project; it becomes visible at about 100 000 events a day for one issue.
**Not done, decide when it matters** (the plan said to measure first and pre-aggregate only if needed):
1. *Short cache per issue* in the API (the `common/utils/lru-cache.ts` helper exists), keyed by issue and window start, 30 to 60 s. Cheapest; the trend can lag the live counters by up to that long, and partial hits (some issues cached) need a little code.
2. *Hourly counters table* `IssueHourlyCount(issueId, hour, count)` upserted in the ingestion transaction. Exact and O(24) to read, but one more statement per event on the hot path, which is what ISSUE-3 to 6 showed to cost write volume.

### Design of the mark (dataviz skill, scaled to a 72 x 20 px row mark)
- Hourly columns (2 px wide, 1 px apart), not a line: counts per hour are discrete and a line would imply the quiet hours are continuous. An empty hour draws nothing over a hairline baseline.
- Each row is scaled to its own peak, with a 2 px minimum so one event still shows. The shape of the trend is the point; the total is the number beside it. Consequence: a single event fills the height of its row.
- Earlier hours in the recessive tone (`muted-foreground` at 70%, about 3.2:1 on a white card, above the 3:1 minimum for graphics), the current hour in the accent (`--primary`, the same violet as the other charts' first series).
- One accessible label per row ("1 541 events in the last 24 hours, at most 1 000 in one hour" / "No events in the last 24 hours") and the same text as the native tooltip. Per-bar tooltips are pointless at 2 px.
- Hidden below the `md` breakpoint: the row has no room for it there.
- The skill's "4 px rounded end, 2 px surface gap" specs are for larger charts; here the ends have `rx=1` and the gap is 1 px.

### Verification
- `verify-trend.ts` (real database, real service): a throw-away issue with events on exact hour boundaries gives `[1,0,...,1,0,0,0,3,2]`: the first instant of the window counts, the event 1 ms before it and the event in a future hour are ignored. For real issues, every trend of a page sums to an independent SQL count (62 events on the "last seen" page).
- Unit tests: window start (mid-hour, exact hour, midnight and month end in UTC), zero fill, placement of the first and last hour, out-of-window and off-hour rows, issues kept apart; the repository asks for the whole page in one query with every value bound and no query for an empty page; the service passes the page's ids only (not the extra row) and the window start.
- The sparkline was rendered to static markup and its geometry checked numerically (size, bounds, common baseline, minimum height, accent only on the current hour, singular/plural label). **It was not looked at in a browser** (no browser tool was available): check the rendering yourself.

### Limits
- Hours are UTC, not the viewer's time zone.
- The current hour is partial, so the last column is usually lower than it will end up.

## ISSUE-9: bulk actions (done)

**Feature.** Tick issues in the list and resolve, ignore or reopen them together.
- API: `PATCH /v1/organizations/:orgId/projects/:projectId/issues` with `{ issueIds, status }` (1 to 100 unique ids; shared `bulkUpdateIssuesSchema`) answers `{ updated }`. Any member can use it, like the single update.
- Dashboard: a checkbox per row, a selection bar under the filters that stays in view while scrolling (`sticky`, under the top bar), "select all loaded" with the usual three states, `x` ticks the row the keyboard is on and `Esc` clears. The selection belongs to the filters it was made under: another filter or sort starts from nothing. A selection of more than 100 is split into requests of 100.
- Undo: the toast remembers the status each issue had, so undoing sends at most three requests (one per previous status) and never touches issues that did not change.

**Rules of the server side** (one `UPDATE ... WHERE projectId AND id IN (...) AND status <> new`):
- Ids of another project (or organization) match nothing and are not reported: the answer is only a count, so it cannot tell "exists elsewhere" from "does not exist". The route checks the project against the organization first (404), like every route.
- An issue that already has the status is skipped and keeps its `resolvedAt`. `resolved` sets it, any other status clears it (the same helper as the single update).
- Eight identical requests at once: each issue is counted once, by the request that wins (`counts 3,0,0,0,0,0,0,0` in the check below).
- A bulk change and an ingestion regression (`resolved` -> `unresolved`, which has the old status in its `where`) are each atomic, and the last one wins, as with the single update.
- **Fix of a gap from earlier:** `IssuesRepository.updateStatus` updated by id only. It now takes the project id too (`updateMany` + read, null when nothing matched, a 404 if the issue vanished between the check and the update).

### The status change no longer reloads every page (the ISSUE-2 follow-up)
The old mutation invalidated the whole list: pressing `r` with 5 pages loaded cost 5 requests, one after another. Now `issues-cache.ts` patches what is cached: rows are updated in place, removed from lists that filter by another status, and a list that should now contain rows it never loaded (the "Resolved" tab, or the "Unresolved" tab after an undo) is only marked stale. The open issue detail is patched too.

| Action | Requests before | After |
|---|---|---|
| resolve / ignore one issue, 3 pages loaded | 3 | **0** |
| bulk change of any number of issues | n/a | 1 per 100 ids, **0** to reload |
| undo | 3 | 3 (reloads the on-screen tab: the rows it lost cannot be rebuilt) |

Checked against the real `@tanstack/query-core`, counting requests. That check caught a real bug in my first version: the filters sit at position 4 of the list key, I read position 3, so every list would have been treated as "not this status" and the row would have **vanished from every tab, including All**. The keys are now built and read through `issues-keys.ts` (`issuesListKey` / `filtersOfListKey`), and the check builds them with the same helpers.

### Verification
- `verify-bulk.ts` (real database, 11 checks): an issue of another organization is not changed and not counted; an already-resolved issue is skipped and keeps its old `resolvedAt`; resolved gets `resolvedAt` of now, reopen and ignore clear it; 8 parallel identical requests count each change once; the single update of another project's issue returns null and changes nothing.
- Unit tests: repository (exact `updateMany` arguments, `resolvedAt` rules with fake timers, project scope, 0 when nothing matched), service (404 for another organization and nothing written, the same answer for ids that exist elsewhere and ids that exist nowhere, no write for the same status, 404 if the issue vanishes), and the schema (1 to 100 ids, duplicates, non-uuid, unknown status).
- Not looked at in a browser (no browser tool was available): check the selection bar, the checkboxes and the toasts on screen.

### Limits
- "Select all" means all **loaded** rows, not every issue of the filter: with 25 per page that is what the user sees. Selecting a whole filter ("all 35 000 unresolved") would need a server-side "apply to this filter" request, which is a different feature.
- The bulk change waits for the server (no optimistic update). The cached `resolvedAt` of a bulk-resolved issue is the client's clock until the next reload corrects it.
- If one of several requests of a large selection fails, some issues changed and others did not: the lists are reloaded from the server instead of guessing.
- There is no activity log yet, so nothing records who changed what.

---

## Where the backlog stands

All of ISSUE-0 to ISSUE-9 are done, in the local database and working tree only (nothing committed, nothing deployed). Production needs, in order: the five migrations (`yarn db:migrate:prod`), the API and web deploy, the second run of the environments backfill and its check (ISSUE-3), and a restart of anything that loads `@errwise/shared`.

Decisions deliberately left open (each is documented where it came from):
1. The `eventCount` sort index costs about 40 to 50% more WAL per event (ISSUE-6). One raw `UPDATE` per event instead of two would halve the index churn.
2. The title trigram index (ISSUE-4) adds index churn per event; the alternative is a separate immutable search table.
3. The 24-hour trend costs about 0.5 to 0.7 ms per 1 000 events in the window (ISSUE-8): a short cache or an hourly counters table if it shows.
4. The facets read every row of the project (ISSUE-7): a short cache, or a table of known environments and releases.
5. Not built at all: snooze, "ignore until N events", "resolve in next release" (a separate plan, they need columns and ingestion changes).
