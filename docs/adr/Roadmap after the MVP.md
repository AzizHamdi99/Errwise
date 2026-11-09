# Errwise: Roadmap after the MVP

Status: web and API deployed, `@errwise/node` published on npm and tested in a real project.
Goal: turn the MVP into a product developers want to keep using, and a portfolio project that stands out.

---

## 1. Authentication and accounts

### Sign in with Google

- **Flow (Google ID token):** the web app shows a Google button, Google returns a signed token, the browser sends it to `POST /auth/google`, the API verifies it with `google-auth-library`, finds or creates the user, and returns the same JWT/cookie as a normal login.
- **Why this flow:** no redirect back to the API, so it works with web and API on separate domains.
- **Setup:** Google Cloud project, OAuth consent screen (published, not in Testing), Web OAuth client ID with the JavaScript origins `http://localhost:3000` and the production web URL.
- **Env:** `GOOGLE_CLIENT_ID` (API) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web).
- **Database:** make `passwordHash` optional, add `googleId String? @unique`.
- **Account linking:** if the email already exists, link the Google account only when Google reports the email as verified (prevents account takeover).

### Other account features

- Password reset, email verification, refresh tokens, 2FA
- Audit log, API key scopes
- Optional: GitHub sign-in

---

## 2. Detection and alerting

### Alerts

- **Rules:** "new issue in production", "issue seen more than N times in M minutes", "regression".
- **Channels:** email, Slack, Discord, generic webhook.
- **Hard part:** throttling. Notify once per issue, then send a summary after a cooldown, so a crash loop does not send thousands of emails.
- **Tables:** `AlertRule`, `NotificationChannel`, `AlertTrigger` (history).

### Regression detection

- If an issue is `resolved` and a new event arrives, set it back to `unresolved`, flag it as a regression, and alert.
- Extension, "resolve in next release": reopen only if the event comes from a release at or after the fix, to avoid false reopenings from old app versions.

### Spike detection

- Compare the last 5 minutes of events with the average for the same hour on previous days. Alert when far above normal. Simple statistics are enough.

### Smarter issue states

- Ignore until N more events, snooze for 24h, ignore until release X.

---

## 3. Richer data from the SDK

### Breadcrumbs

- The trail before the crash: console logs, HTTP requests, clicks, route changes. It shows how the user reached the error.

### User context, tags and scopes

- `Errwise.setUser({ id })` and `setTag('plan', 'pro')`.
- Unlocks "affected users: 42", which is more meaningful than the raw event count.

### Browser SDK and framework integrations

- `window.onerror`, unhandled rejections, a React error boundary, Next.js `error.tsx` and `global-error.tsx`.
- Dogfood it on the Errwise dashboard itself.

### Releases and source maps

- A CLI command uploads `.map` files per release from the customer's CI.
- The dashboard translates minified stack traces into original file, line and surrounding code (`source-map` library).
- This separates a toy from a real tool, and it is the hardest item. Plan it as its own phase.

### Server-side data scrubbing

- Mask emails, tokens, card numbers and `Authorization` headers before storage.

### Session and release health

- The SDK reports sessions started, ended cleanly, or crashed. Compute a crash-free rate per release.

### More SDKs and entry points

- Python SDK.
- Sentry-compatible endpoint, so existing Sentry users can switch by changing one URL.

---

## 4. Intelligence (the differentiator)

### AI root-cause analysis

- Send the stack trace, message, breadcrumbs and, ideally, the code around the failing line to an LLM.
- Return structured JSON: `summary`, `probable_cause`, `suggested_fix`, `confidence`.
- Run it on the first occurrence and when counts cross thresholds, not on every event.
- Cache per issue in an `AiAnalysis` table, and cap daily cost per organization.
- Implement it as a Python FastAPI service.

### Semantic grouping and similar issues

- Embed the normalized error message and top frames, store vectors in Postgres with `pgvector`, search nearest neighbors.
- Use it for "similar issues" and merge suggestions. It fixes the edge cases of fingerprinting.

### Suspect commits and suggested owner

- Releases carry a commit SHA. With the GitHub API, find recent commits touching the files in the stack trace and suggest who likely introduced the bug.

### Ask your errors

- Natural-language search ("payment errors in production this week") translated by an LLM into filters.

### Weekly AI digest

- Email summarizing top issues, new regressions and trends.

### Stretch goal

- The AI proposes a patch and opens a pull request through a GitHub App.

---

## 5. Team workflow

- Assign issues to members, with comments, @mentions and an activity log.
- Create a GitHub / Linear / Jira issue in one click, with a link back.
- Ownership rules, for example errors in `src/payments/*` go to a given member.
- Saved filters, bulk actions, shareable links to filtered views.
- In-app notification bell next to email alerts.

---

## 6. Dashboard and analytics

- Events over time per project and per issue, with a sparkline in the issues list.
- Top issues, most affected users, heatmap by hour.
- On the issue page: tag distribution (browser, OS, release, environment), first seen in release X, similar issues.
- Release comparison, for example "release 1.4.0 added 3 new issues and fixed 5".

---

## 7. Platform and robustness

- **Queue and worker** (Redis, BullMQ): the API returns 202 immediately and a worker processes events. Serverless on Vercel cannot run workers, so host the worker on Railway, Fly.io or a VPS.
- **Quotas and usage page:** events per month per organization, with limits and a usage chart. Base for pricing plans.
- **Billing** in Stripe test mode.
- **Retention job:** delete old events, cap events per issue.
- **Public REST API, webhooks and a CLI** for automation.
- **Self-host in one command** (`docker compose up`) with a clear README.
- **Load test** with k6, to quote "handles X events per second".

---

## 8. Growth and presentation

- Landing page and docs site.
- Guided onboarding with a "Send a test error" button that confirms the first event arrived.
- Public demo account with seeded data.
- Demo video and a technical blog post (for example "How I group errors with fingerprints and embeddings").

---

## 9. Milestones

| Milestone        | Contents                                              | What it proves      |
| ---------------- | ----------------------------------------------------- | ------------------- |
| M1: Alerting     | Alerts, regressions, issue states, spike detection    | Product thinking    |
| M2: Coverage     | Breadcrumbs, user context, browser SDK, scrubbing     | SDK design          |
| M3: Workflow     | Assign, comments, charts, GitHub issue creation       | Full-stack depth    |
| M4: Intelligence | AI analysis, embeddings, suspect commits              | AI engineering      |
| M5: Scale        | Queue, quotas, load test, self-host                   | Backend engineering |
| M6: Ship         | Landing page, docs, video, source maps if time allows | Visibility          |

Recommended order: M1 and M2 first. They are fast to build and make M4 better, because AI analysis works much better with breadcrumbs and user context than with a stack trace alone. Google sign-in can be done at any point, and it is a good small task between milestones.

---

## 10. Working rules

- One milestone at a time. New ideas go to `docs/ROADMAP.md`, not into the code.
- Small pull requests, CI green before merging.
- Keep a short dev log per milestone: it becomes blog posts and interview stories.
- Never cut tests or security (tenant isolation, hashed keys, idempotency) to save time.
