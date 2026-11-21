# ADR-007: Password reset by emailed link

Status: Accepted
Date: 2026-11-21

## Context

A user who forgot their password had no way back into their account: no reset flow existed, and
support could not help without touching the database. Accounts created with Google have no
password at all and could not add one.

Email verification (ADR-006) already solved the same shape of problem: prove the user controls an
address with a single-use, expiring link. This ADR reuses that design.

## Decision

**A reset link sent by email, used once, that sets a new password and signs out everywhere.**

- `POST /v1/auth/forgot-password { email }` always answers `204`. It does nothing, silently, for an
  unknown email or when a link was sent less than `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` ago
  (default 60). Limited to 5 calls per 10 minutes per address, because each call can send an email.
- The link is `WEB_URL/reset-password?token=…`: 32 random bytes (base64url). Only its sha256 is
  stored, in `PasswordReset` (one row per user, `userId` is the primary key, so a new link replaces
  the old one). It lives `PASSWORD_RESET_TTL_MINUTES` (default 60). If the email cannot be sent,
  the link is deleted: a link nobody received is not kept. A mail failure never becomes an error.
- `POST /v1/auth/reset-password { token, password }` is sent by the web page, never a `GET`, so a
  mail scanner that opens the link cannot use it. Limited to 20 calls per 10 minutes.
  - A cheap lookup refuses an unknown or expired token **before** bcrypt, so guessing costs no CPU.
  - The password is hashed **before** the transaction, so the slow work never holds it open.
  - One transaction then: deletes the link with the token and the expiry in the `where` (the
    "first one wins" pattern: two requests with the same link, one succeeds), sets the new
    password, marks an unverified email as verified (the link proves the address) and drops its
    pending verification link, and revokes every refresh token of the user.
  - Unknown, expired and used links get one generic `400`.
  - It does **not** sign in. The user logs in with the new password.
- The page reads the token once, removes it from the address bar and sends no `Referer`.
- A Google-only account can use the flow to set a password. That is safe: opening the link proves
  the address, which is what Google vouched for.

## Consequences

- One new table, additive: migrate production first, then deploy.
- **Access tokens are not revoked.** Refresh tokens are revoked at once, but an access JWT already
  issued stays valid until it expires (`ACCESS_TOKEN_TTL_SECONDS`, 15 minutes by default). Closing
  that window would need a per-user "sessions invalidated at" checked on every request, one more
  query per API call. Accepted for now. The same holds for "sign out everywhere" (account settings).
- The response time still differs between a known email (a link is saved and mailed) and an
  unknown one. Registering already reveals which emails exist (ADR-006), so this leaks nothing new.
- Rate limits are in memory, per instance, like every other public route.

## Alternatives considered

- **A short code typed into the page instead of a link:** works across devices, but a 6-digit code
  needs attempt counting per user to resist guessing. A 32 byte link does not.
- **Sign in right after the reset:** one step shorter, but it would turn the emailed link into a
  login link. Keeping "the link sets a password, the password signs in" matches ADR-006.
- **Keep the other sessions alive:** friendlier, but the usual reason for a reset is a password
  someone else may know. Revoking every session is the safe default.
