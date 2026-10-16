# ADR-001: Store API keys as hashes

Status: Accepted
Date: 2026-10-16

## Context

The SDK authenticates to POST /v1/events with an API key. If the database
leaks, plain-text keys would let an attacker send events to every project.

## Decision

- Generate keys as `ew_live_` + 32 random alphanumeric characters
  (crypto.randomInt).
- Store only sha256(key) in `keyHash` (unique) and the first 12 characters
  as `prefix`, for display.
- Show the full key once, at creation. It cannot be recovered.
- Look up a key by its hash. The row gives the project: the key carries no ids,
  and the project is never taken from the request body.
- Keys can be revoked (`revokedAt`). Revoked keys, and keys of deleted
  projects or organizations, are rejected with the same 401 as unknown keys.

## Why SHA-256 and not bcrypt

Keys have about 190 bits of entropy, so they cannot be brute-forced from a hash.
A fast hash is safe here and allows a direct indexed lookup on every request.
bcrypt is slow on the hot ingestion path and cannot be searched by value.
Passwords are different: they have low entropy, so they use bcrypt.

## Consequences

- A database leak does not expose usable keys.
- Fast, indexed lookup on every event.

* A lost key cannot be shown again. The user creates a new one and revokes the old.

## Alternatives considered

- Plain-text keys: simple, but a leak exposes every project.
- Signed keys (JWT): cannot be revoked without a database check anyway.
- Project id inside the key: saves no lookup and leaks ids.

## Tests

`api-keys.e2e-spec.ts` checks the hash storage and the rejection cases.
