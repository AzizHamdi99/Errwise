# ADR-002: Version the API in the URL

Status: Accepted
Date: 2026-10-16

## Context

Two kinds of clients call the API:

- The dashboard, which we deploy together with the API.
- The SDK (`@errwise/node`), which is published to npm and runs in apps
  we don't control. Old SDK versions stay in production for a long time.

A breaking change to an endpoint would break every installed SDK at once.

## Decision

- Use URI versioning: every route is prefixed with a version, for example
  `POST /v1/events`, `POST /v1/auth/login`.
- Implement it with NestJS `enableVersioning` and `defaultVersion: '1'`,
  so controllers need no change and one controller can move to `v2` later.
- Keep `/health` unversioned (`VERSION_NEUTRAL`), so uptime checks and
  load balancers use a stable path.
- The SDK's default endpoint includes the version (`/v1/events`).

## What counts as a breaking change

A new version is needed only for breaking changes: removing or renaming a
field, changing a field's meaning or type, or changing status codes.
Adding optional fields or new endpoints stays in the current version.

## Consequences

- Old SDKs keep working when `v2` ships; both versions can run side by side.
- The version is visible in logs, docs and browser dev tools.

* Every client URL carries the prefix, including the dashboard.
* The refresh cookie path must follow the prefix (`/v1/auth`), or the
  browser stops sending it.
* Supporting two versions costs maintenance, so we only add one when needed
  and set a deprecation date for the old one.

## Alternatives considered

- Header versioning (`Accept: application/vnd.errwise.v1+json`): clean URLs,
  but harder to test by hand, to cache, and to see in logs.
- No versioning: simplest today, but a breaking change would force every
  SDK user to upgrade immediately.
- Query parameter (`?version=1`): easy to forget and mixes with filters.
