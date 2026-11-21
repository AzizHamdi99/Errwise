# ADR-006: Verify the email address before an account can be used

Status: Accepted
Date: 2026-11-21

## Context

Anyone could register with any address, typed by hand, and was signed in at once. Nothing proved
the address was theirs or even real. That matters for the product: alert emails, invitations and
the digest all go to that address, so a wrong or someone else's address means errors reported to
a stranger, and a stranger holding an account on that address.

`User.emailVerifiedAt` already existed. Only Google sign-in (Google vouches for the address) and
accepting an invitation (the invitation was sent to that address) set it, and nothing read it.

## Decision

**An account cannot sign in until its email is verified, and registering does not sign anyone in.**
- `POST /v1/auth/register` creates the account, mails a link, and answers
  `{ email, verificationEmailSent }`. No cookie is set. If the email cannot be sent the account is
  kept and the user asks for another link: a mail problem never loses a sign-up.
- `POST /v1/auth/login` answers `403` with `code: "EMAIL_NOT_VERIFIED"` for an unverified account.
  This is checked **after** the password, so only someone who knows the password learns that the
  account exists and is waiting. A wrong password is still `401`.
- `POST /v1/auth/refresh` also refuses an unverified account, which closes the gap for a session
  that was created before the rule existed.

**The link.**
- A 32 byte random token, valid 24 hours (`EMAIL_VERIFICATION_TTL_HOURS`). Only its sha256 is
  stored, like invitations and refresh tokens, so a copy of the database cannot be used to verify.
- Table `EmailVerification`, with `userId` as its primary key: at most one link per user, and a new
  one replaces the old one (which stops working). `tokenHash` is unique. It is deleted with the user.
- The link opens a page of the web app, which sends the token with a `POST` to
  `/v1/auth/verify-email`. A `GET` that verified would be used up by mail scanners and link
  previews that only open the address. The page also removes the token from the address bar and
  the history, and the page declares `referrer: no-referrer` in its metadata (a meta tag).
- Using a link deletes it and sets `emailVerifiedAt` in one transaction. The delete carries the
  token and the expiry in its `where`, so when two requests use the same link only one deletes it:
  the same "first one wins" pattern as the ingestion status flips. The user update only touches a
  user who is not verified yet, so an account verified another way keeps its original date.
- Unknown, expired and already used links all get the same `400`.

**Resend.** `POST /v1/auth/resend-verification` always answers `204`, whether or not the address
has an account, and does nothing for an unknown address, a verified one, or a link sent less than
`EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS` (60) ago. The cooldown is read from the database
(`sentAt`), so it survives restarts and serverless instances.

**Limits on the public routes** (new rule from CLAUDE.md): `register` 10, `verify-email` 20 and
`resend-verification` 10 per 10 minutes per client address, with `Retry-After` on the `429`.
`register` matters most: every call sends an email to whatever address was typed.
The limiter is in memory (`FixedWindowLimiter`, `RateLimitGuard`, `@RateLimit`), like the
ingestion limit, so it resets on restart and each instance counts for itself.

**Existing accounts.** The migration marks every account that exists when it runs as verified
(`UPDATE "User" SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL`). This asserts a
verification that never happened. It was a deliberate choice of the owner, because the app had no
real users, and it is the only way nobody is locked out on the day of the deploy.

**Error codes.** The global exception filter used to rebuild every error as
`{ statusCode, message, path, timestamp }`, which dropped anything else. It now also passes on a
string `code` thrown by our own code (and nothing else), so a client can tell a `403` for an
unverified email from any other `403`. The web reads it as `ApiError.code`.

## Consequences

- The `register` response changed (no session, no `user`). The API and the web must be deployed
  together; deploy the API first, then the web.
- Production mail has to work **before** the deploy, or nobody can finish signing up. Production
  uses SMTP (`MAIL_DRIVER=smtp`, `SMTP_*`, `MAIL_FROM`). Break-glass for one account:
  `UPDATE "User" SET "emailVerifiedAt" = now() WHERE email = '...'`.
- Registering through an invitation link no longer lands directly on the invitation: the invitee
  verifies, logs in and goes to the onboarding. They open the invitation email again to accept it.
- Verified by: unit tests (service, repository, auth service, email template, limiter, guard,
  exception filter), `scripts/verify-email-verification.ts` against the real database (eight
  requests with the same link: exactly one wins), and a walk-through over HTTP.

## Accepted risks and known limits

- **Re-registering an existing email answers 409**, as before, even if that account was never
  verified. Someone who registers another person's address with their own password parks it, and if
  the real owner then uses "send again" and opens the link, the account they verify has the
  attacker's password. The email says to ignore it if you did not register, and Google sign-in on
  that address already wipes the password of an unverified account (`GoogleAuthService`), but the
  gap is real. Letting a new sign-up replace an unverified account would close it; it was left out
  on purpose.
- **Rate limit address.** It uses `req.ip`. The API does not set Express `trust proxy`, so behind a
  proxy that may be the proxy's address and every client shares one allowance. The limits are
  generous for that reason. Set `trust proxy` for the real number of hops once the topology is
  known; a wrong number lets clients spoof their address.
- **Timing.** `resend-verification` answers the same, but an address with an account takes longer
  (it sends an email). Registering already reveals existing addresses with its `409`.
- **Two resends at the same instant** can both pass the cooldown check and send two emails; the
  last link saved is the one that works.
- The 60 second countdown of the resend button is a constant in the web, matching the server
  default. If the server value is changed the button may be enabled too early; the server decides.

## Alternatives considered

- **Sign in at once, restrict the app until verified.** The user would get in and see a banner.
  Rejected: every route would need a check (or the claim would live in the token and go stale),
  and an address that is not proven would already be inside the product.
- **Columns on `User`** (`tokenHash`, `expiresAt`, `sentAt`) instead of a table. One table less,
  but it mixes token state into the users table and adds a unique index to it. A table with
  `userId` as primary key gives "one link at a time" for free and deletes itself with the user.
- **A `GET` link that verifies directly.** Simpler for the user, but mail scanners and link
  previews would use the link before the person does.
- **`@nestjs/throttler`** for the limits. It would add a dependency for three routes; the in-memory
  limiter is about forty lines and has the same limits as the one already used for ingestion.
- **Marking existing accounts verified at their next login** instead of in the migration. More
  honest, but it needs mail to work first and locks out anyone with an unreachable address.
