# ADR-005: Show the code around stack frames, read from GitHub on demand

Status: Accepted
Date: 2026-11-20

## Context

A stack trace says `at getUser (/var/task/src/users.service.js:42:23)`. The developer then opens
their editor to find the line. Errwise already knows the project's GitHub repository, and if it
also knows which commit was deployed, it can show the real code on the issue page and give the AI
analysis the code it needs to be precise.

The code belongs to the customer, so the design is driven by consent and by not keeping it.

## Decision

**The deployed commit travels with the event.**
- The SDK (0.2.0) sends `commitSha`, read from the `commit` option or the variable of the host
  (Vercel, GitHub Actions, Render, Railway, Heroku, Cloudflare Pages, or `ERRWISE_COMMIT_SHA`).
- The API stores it in `Event.commitSha`. If the SDK sent none and `release` itself is a commit
  hash (it must contain a letter, so dates and build numbers are not mistaken for commits), that
  is used instead.
- A malformed commit is ignored, never a reason to reject an error report.

**Opt-in per project, owner only.**
- `Project.sourceContextEnabled`, off by default. Changed through the existing project update
  route, which is already owner-only. Disconnecting GitHub switches it off again.
- The feature needs the GitHub App permission **Contents: Read-only**. Installations must accept
  it, and until they do the feature degrades to a clear message and nothing else is affected.

**Code is read on demand and never stored.**
- Errwise resolves the commit, reads the repository tree at that commit, maps each in-app stack
  frame to a repository file, and fetches the few lines around it. Only the cache of the current
  API instance (memory, bounded) holds code. A commit is immutable, so it can be cached safely.
- No snippet table. A cold start on serverless refetches from GitHub, which is acceptable
  (about 5,000 calls per hour per installation, and one page view costs a few).

**Frame paths are untrusted input.**
- A frame path is chosen by the monitored app. It is never used to build a request. The API only
  reads paths that exist in the repository tree, picked by a longest-suffix match. An ambiguous
  match or a compiled output path (`dist/`, `build/`) answers "no code" instead of wrong code.

**The AI analysis may receive the snippets, only when the toggle is on.**
- They are scrubbed like the error text, treated as untrusted data in the prompt (their own
  `<source_code>` block, with both blocks' closing tags neutralized), limited to five snippets of
  2,000 characters, and part of the analysis cache key. This is stated next to the toggle and on
  the analysis card. Reading the code is best effort: if it fails, the error is analyzed without
  it. Which files were read is stored with the analysis (`sourceFiles`) and shown to the user.
- Prompt v3 asks the model to cite the file and line it relies on, and counts code that states
  the cause outright as grounds for high confidence. Checked with repeated real calls: the same
  error was rated medium or low without code and high with it.

## Consequences

- Two additive columns: `Event.commitSha` and `Project.sourceContextEnabled`.
- The GitHub App gets a new permission, which every installation owner must accept.
- Most Node servers run compiled code. Without `--enable-source-maps`, many frames cannot be
  mapped to source files and are reported as such. Uploading source maps is a possible later step.
- Customer code reaches the LLM provider when the owner turns the feature on. That is a conscious,
  visible choice, and it is the reason for the per-project switch.

## Alternatives considered

- **Store snippets in Postgres:** faster after a cold start, but Errwise would then keep customer
  code and have to expire it.
- **On for everyone with the permission:** simpler, but no explicit consent per project.
- **Release name instead of commit:** a release such as `1.4.0` cannot be looked up in Git.
- **Fetch code in the browser with a user token:** keeps code off our servers, but needs a
  GitHub login per user and breaks the AI use case.
