# ADR-008: Organization audit log

Status: Accepted
Date: 2026-11-21

## Context

Owners could not answer "who revoked this API key?", "who made Bob an admin?" or "who turned on
sending our source code to the AI?". These are security questions: keys grant ingestion, roles
grant control, source code is the most sensitive thing Errwise can read (ADR-005). Nothing kept a
history of them.

## Decision

**An append-only `AuditLog` table, written by the services after an action succeeds, read by
owners and admins on one page.**

What is recorded (`AUDIT_ACTIONS` in `packages/shared/src/audit.ts`):

| Area          | Actions                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| API keys      | `api_key.created`, `api_key.revoked`                                        |
| Members       | `member.role_changed`, `member.removed` (`left: true` when they left)       |
| Invitations   | `invitation.sent`, `invitation.resent`, `invitation.revoked`, `.accepted`   |
| Projects      | `project.created`, `project.updated`, `project.deleted`                     |
| Source code   | `project.source_context_enabled`, `project.source_context_disabled`         |
| GitHub        | `github.connected`, `github.repo_selected`, `github.disconnected`           |
| Organization  | `organization.renamed`                                                      |

**Writing: after success, best effort.** `AuditService.record()` is called once the action has
committed, and it never throws: a failed write is logged (action name only) and the user's action
stands. Only real changes are events: setting the same role, saving an unchanged name, or a second
revoke of a key (the atomic `updateMany` tells which request won) record nothing.

**What an entry holds.** Organization, optional project, actor (set to null if the user is
deleted), action, target type and id, and a small flat `metadata` (at most 10 keys, strings capped
at 200 characters): names, emails members can already see, old and new role, repository name, the
public key prefix. **Never** an API key, a hash, a token, a request body or event data. The mapper
returns only flat scalar values, whatever the column holds.

**Reading.** `GET /v1/organizations/:orgId/audit-log?cursor=&limit=&action=`, owners and admins
(`@OrgRoles`). Another organization answers `404`, a member `403`. There is no route to update or
delete an entry. Ids are UUIDv7, so time-ordered: the list sorts and pages on `id` alone, the cursor
is the last id, and both list shapes use an index (`(organizationId, id DESC)` and
`(organizationId, action, id DESC)`). One extra row tells whether a next page exists, without a
count.

**`projectId` has no foreign key**: an entry outlives its project, and its metadata keeps the name.
Organizations are soft-deleted, so their log stays in the database (the foreign key cascades only
on a hard delete).

**`AuditModule` is global**, like `PrismaModule`: six modules record entries, memberships among
them, and the audit controller needs memberships' guard. Regular imports would make the two modules
import each other.

**Retention:** kept as long as the organization exists. The rows are small and written only on
human actions, so volume is not a concern for now.

## Consequences

- One new table, additive: migrate production first, then deploy.
- A crash between the action and the write loses that one entry. Accepted: the alternative below
  costs more than the gap is worth today.
- Several services take an `actorId` they did not need before.
- The organization deletion itself is not recorded: the log disappears from view with it.
- The dashboard builds sentences from metadata and renders them as text, never as HTML.

## Alternatives considered

- **Write the entry in the same transaction as the action:** no gap at all, but every repository
  would have to accept a transaction client, a refactor across six modules. Worth revisiting if
  the log becomes a compliance requirement.
- **Database triggers:** catch every change, even outside the API, but know nothing about the actor
  or the intent, and live outside the code reviewers read.
- **Log lines instead of a table:** free to add, but not queryable per organization, not visible
  to owners, and logs are not kept long enough.
