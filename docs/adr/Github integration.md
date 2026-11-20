# Errwise: GitHub integration

GitHub is the source of truth for **who fixes what**. Errwise only keeps the error state in sync with it.
It does not manage tasks, assignees or comments of its own.

## 1. What it does

| Capability       | Behavior                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Connect          | The organization owner installs the GitHub App and picks one repository per project.                                             |
| Create issue     | Any member clicks "Create GitHub issue" on an Errwise issue. One click, idempotent.                                              |
| Sync from GitHub | Closing the GitHub issue resolves the Errwise issue. Reopening it sets it back to unresolved.                                    |
| Regression       | If a resolved issue happens again, Errwise reopens it, emails the subscribers, then reopens the GitHub issue and comments on it. |

```
Errwise issue ──(one click)──────────────► GitHub issue
      ▲                                         │ closed / reopened
      │ resolved / unresolved                   ▼
      └──────────── POST /github/webhook ◄── GitHub App webhook

New event on a resolved issue
  └─► status = unresolved, regressionCount + 1
        ├─► email to project subscribers
        └─► GitHub issue reopened + comment (best effort)
```

## 2. Data model

**Project**: `githubInstallationId`, `githubRepo` (`owner/repo`), index on `githubRepo`.

**Issue**

| Field                                 | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `githubIssueNumber`, `githubIssueUrl` | Link to the GitHub issue. Unique per `(projectId, githubIssueNumber)`. |
| `githubIssueClaimedAt`                | Short lock while the GitHub issue is being created (60 s TTL).         |
| `githubState`                         | `open` or `closed`, cached from GitHub. `null` means open.             |
| `regressionCount`, `lastRegressionAt` | How often and when the issue came back.                                |
| `lastRegressionNotifiedAt`            | Last regression already emailed (dedupe on retries).                   |

**GithubWebhookDelivery**: `id` (the `X-GitHub-Delivery` header), `event`, `receivedAt`. Makes webhook processing idempotent.

## 3. Endpoints

| Method | Path                                                  | Who            | Purpose                                                    |
| ------ | ----------------------------------------------------- | -------------- | ---------------------------------------------------------- |
| GET    | `/v1/organizations/:orgId/projects/:projectId/github` | member         | Connection status                                          |
| POST   | `.../github/install-url`                              | owner          | Signed install URL                                         |
| GET    | `.../github/repositories`                             | owner          | Repositories of the installation                           |
| PUT    | `.../github/repository`                               | owner          | Select the repository                                      |
| DELETE | `.../github`                                          | owner          | Disconnect (existing issue links are kept)                 |
| POST   | `/v1/integrations/github/complete`                    | logged-in user | Finish the install after GitHub redirects back             |
| POST   | `.../issues/:issueId/github`                          | member         | Create the GitHub issue (returns the existing link if any) |
| POST   | `/github/webhook`                                     | GitHub only    | Receives `issues` events (no `/v1`, no JWT)                |

## 4. How each part works

### 4.1 Connecting a project

1. The owner calls `install-url`. The API signs a short-lived `state` (JWT, 10 min, purpose `github-install`) holding `projectId`, `organizationId` and `userId`.
2. GitHub sends the owner back with `code` and `installation_id`.
3. `complete` verifies the state, checks that the same user finishes the flow, **re-checks the owner role**, exchanges the code for a user token, and asks GitHub whether this user really has access to that installation. Only then is the installation saved.
4. The owner picks a repository from the installation's list. A repository outside the installation is rejected.

### 4.2 Creating the GitHub issue

- Returns the existing link if the issue was already created.
- Takes an atomic claim (`updateMany` on `githubIssueClaimedAt`). Only one concurrent request creates the issue. A claim older than 60 s is treated as dead.
- The content (`github-issue-content.ts`) truncates long values, wraps SDK-provided text in inline code and fences longer than any backtick run, so it cannot become markdown or `@mentions`.
- On failure the claim is released.

### 4.3 Webhook: GitHub to Errwise

1. Verify `X-Hub-Signature-256` with HMAC SHA-256 on the **raw body** and `timingSafeEqual`.
2. Insert the delivery ID. A duplicate returns `{ ok: true, duplicate: true }`. If processing fails, the delivery row is deleted so GitHub's retry is processed.
3. `ping` returns `{ ok: true, pong: true }`. `issues` is validated with Zod and handled.
4. `closed` and `reopened` update every Errwise issue matching **repo (case-insensitive) + installation id + issue number**:
   - closed: `unresolved` becomes `resolved` (`resolvedAt = now`)
   - reopened: `resolved` becomes `unresolved` (`resolvedAt = null`)
   - `ignored` issues keep their status, but `githubState` is always updated

Each rule is a single `updateMany` with the status in the `where`, so it is atomic.

### 4.4 Regression

- `IngestionRepository.storeOnce` flips `resolved` to `unresolved` inside the event transaction. The status is in the `where`, so only the request with `count === 1` counts as the regression. A duplicate event rolls the whole transaction back and cannot reopen anything.
- `IngestionService` collects `created` and `regressed` alerts and makes one `dispatch` call after all transactions commit.
- `ALERT_DELIVERY=direct` sends inline (time budget 8 s, for Vercel). `queue` publishes `issue.created` and `issue.regressed` to RabbitMQ and the worker consumes them.
- `RegressionHandler` runs two things in parallel:
  - `RegressionNotifier`: the email. Dedupe compares `lastRegressionNotifiedAt` with `lastRegressionAt`, so a retry never sends a duplicate and a new regression always sends a new email. It throws if no email could be sent, so the queue retries.
  - `GithubRegressionSync`: never throws. It claims `githubState: closed -> open`, reopens the GitHub issue, then comments. If the reopen call fails, the claim is released.

## 5. Security

- The webhook is public by design. The HMAC signature replaces authentication, and no user guards are on it.
- The install flow is protected against forged requests: signed state, same-user check, owner re-check, and installation access verified with GitHub.
- All queries are scoped by organization or project. A project from another tenant returns 404.
- The GitHub client never logs tokens or response bodies. Installation tokens are cached in memory with a 5-minute safety margin.
- SDK-provided text is never interpreted as markdown in GitHub content.

## 6. Environment variables

| Variable                                           | Used by                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `GITHUB_APP_SLUG`, `GITHUB_APP_ID`                 | Install URL, app JWT                                           |
| `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | OAuth code exchange                                            |
| `GITHUB_APP_PRIVATE_KEY_BASE64`                    | App JWT (RS256)                                                |
| `GITHUB_STATE_SECRET`                              | Signing the install `state`                                    |
| `GITHUB_WEBHOOK_SECRET`                            | Verifying webhook signatures (same value as in the GitHub App) |
| `WEB_URL`                                          | Links back to Errwise in GitHub and emails                     |
| `ALERT_DELIVERY`                                   | `direct` (production on Vercel) or `queue`                     |

In queue mode the worker also needs the `GITHUB_*` variables, because it loads the GitHub module.

## 7. GitHub App settings

- Repository permission **Issues: Read & write**.
- Repository permission **Contents: Read-only**, for the optional source code feature (ADR-005). Add it in GitHub, under Settings, Developer settings, GitHub Apps, your app, Permissions & events. Every existing installation then has to **accept** the new permission at `github.com/settings/installations`; until it does, reading code fails with `no_permission` and nothing else is affected.
- **Subscribe to events: Issues**. After a permission change, the installation owner must accept it at `github.com/settings/installations`, otherwise no events are sent.
- Webhook URL: `https://<api>/github/webhook` in production. An app has **one** webhook URL, so for local work point it to a smee.io channel (`npx smee-client --url <channel> --target http://localhost:4000/github/webhook`) or create a second "Errwise Dev" app.

## 8. Deploying

1. `yarn db:status:prod`, then `yarn db:migrate:prod` (reads `apps/api/.env.production`). **Migrate before deploying the code**, or the new columns do not exist yet.
2. Deploy the API.
3. Set `GITHUB_WEBHOOK_SECRET` and the other variables in Vercel.
4. Point the GitHub App webhook to the production URL and redeliver a `ping`: expect 200.

## 9. Pitfalls we hit

| Symptom                              | Cause                                                                    | Fix                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 404 on the webhook                   | URI versioning (`defaultVersion: '1'`) served it at `/v1/github/webhook` | `@Controller({ path: 'github', version: VERSION_NEUTRAL })`                                         |
| Signature always invalid             | Body was parsed before hashing                                           | `NestFactory.create(AppModule, { rawBody: true })`                                                  |
| 500 in production                    | Migration not applied on Neon                                            | `yarn db:migrate:prod`, then redeploy                                                               |
| No `issues` delivery at all          | Event not subscribed, or new permission not accepted                     | Subscribe to Issues, accept the permission on the installation                                      |
| 200 but nothing changes              | No match on repo + installation id + issue number                        | Compare the payload with `Project.githubRepo`, `githubInstallationId` and `Issue.githubIssueNumber` |
| Source code says "accept the permission"  | Contents permission added after the app was installed                    | The installation owner accepts it at `github.com/settings/installations`                            |
| Redelivery returns `duplicate: true` | A redelivery reuses the same delivery ID                                 | Expected. Trigger a new event to test again.                                                        |

## 10. Test checklist

1. Connect a project, select a repository, create a GitHub issue from an Errwise issue.
2. Close the GitHub issue: the Errwise issue becomes `resolved`, `githubState = closed`.
3. Reopen it: back to `unresolved`, `githubState = open`.
4. Mark the Errwise issue `ignored`, close the GitHub issue: the status stays `ignored`, only `githubState` changes.
5. Resolve the issue, trigger the same error: reopened, `regressionCount = 1`, regression email received.
6. With a closed GitHub issue: the GitHub issue is reopened and has the regression comment.
7. Trigger it again: no second email and no second comment.

## 11. Known limits and next steps

- One webhook URL per GitHub App (use smee or a dev app locally).
- The GitHub sync only runs when `githubState` is `closed`. An issue never synced has `null` and is treated as open.
- The comment after a successful reopen is not retried if it fails.
- Not done on purpose: assignees and comments live in GitHub. A possible later addition is copying an Errwise owner to the GitHub assignee.
- Next in M1: hourly email cap per project, snooze and "ignore until N events", spike detection.
