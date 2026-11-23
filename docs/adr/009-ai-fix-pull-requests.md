# ADR-009: AI fix suggestions and pull requests

Status: Accepted (implemented and tried end to end on a real repository, see "What was checked against GitHub")
Date: 2026-11-23

## Context

Errwise explains an error (ADR-004), reads the code around the failing frames (ADR-005) and opens
a GitHub issue. The developer still writes the fix. With the stack trace and the code at the
deployed commit, an LLM can propose a small patch for local bugs (a missing null check, a missing
`await`, a wrong property), and Errwise can open a pull request with it.

This is the first time Errwise **writes** to a customer's repository, and the patch is derived
from text that anyone holding an ingest key controls (the error message). That drives the design.

## Decision

**Two clicks, never automatic.**
- Suggest (any member, one slot of the organization's daily AI allowance). The result is shown as
  a diff in Errwise.
- Open pull request (owner or admin, audited). A **draft** PR from a branch
  `errwise/fix-<fixId>`. Errwise never merges and never force-pushes.

**Opt-in per project, owner only.** `Project.fixPullRequestsEnabled`, off by default, usable only
while `sourceContextEnabled` is on. Consent to read code is not consent to write to the repo.

**The patch is a list of search/replace edits, validated by the server.** Models get diff line
numbers wrong. The server accepts a patch only if every edit targets a file that was sent, with a
code extension, matches exactly once inside a window that was sent, does not overlap another edit,
does not bring in a scrub placeholder, and stays within the size caps (3 files, 60 lines). The PR
is always built from the stored edits, re-applied on the default branch HEAD, never from a body
sent by the browser.

**Only the edits are stored** (`IssueFix.edits`, nullable), never whole files. The row also keeps
the repository, installation and commit it was made for, so a PR can never be opened somewhere
else, and `@@unique([repo, prNumber])` is the database backstop for one pull request per fix. They are wiped when either switch
is turned off, GitHub is disconnected, or the repository changes. This amends ADR-005's "never
stored": small, bounded, consented, and short-lived by rule.

**Model.** `gpt-oss-120b` on Groq through `LLM_FIX_MODEL`. The free plan allows 8,000 tokens per
minute for the model, prompt and answer together, so only small windows of code fit.

**Least privilege tokens (this step).** The GitHub App will hold Contents: write and Pull
requests: write, but every installation token is requested for one purpose and one repository:

| Purpose    | Permissions                              | Used by                         |
| ---------- | ---------------------------------------- | ------------------------------- |
| `metadata` | metadata: read                           | listing the installation's repos |
| `issues`   | issues: write                            | create, reopen, comment         |
| `read`     | contents: read                           | source code on the issue page   |
| `fix`      | contents: write, pull_requests: write    | opening the fix PR (step 5)     |

A bug or leak in the issue or read paths can then never write code. The token cache is keyed by
installation, purpose and repository, so a narrow token is never served for a wider request.

If GitHub refuses to mint a token (`422`: the owner has not accepted the new permissions, or the
repository is outside the installation), the reader answers `no_permission`, the same message as
a `403` on the read itself.

## Consequences

- The GitHub App gets two new permissions that every installation must accept. Until it does,
  reading, issues and analysis keep working with their narrower tokens.
- One more token request per purpose and repository per hour (cached in memory).
- Customer CI runs the pushed branch. The diff review in Errwise, by an owner or admin, is the
  control that comes **before** the push.

## How a suggestion is made (step 4)

`POST /v1/organizations/:orgId/projects/:projectId/issues/:issueId/fix` (any member), `GET` for
the latest one. In this order, so a refusal never costs anything: tenant scope, both switches,
GitHub connection, the AI service configured, the files behind the top stack frames (at most
three, one window each, only files a fix may touch), the default branch still has those lines
(409 otherwise, no slot), the stored fix for the same input (free), the organization's daily
slot (shared with analysis through `AiQuotaService`), the model, the check of its edits against
the real files (`fix-patch.ts`), then one transaction that locks the project row and stores the
edits only if both switches and the repository are still as they were.

- **No code outlives its consent.** Turning source code or fixes off, disconnecting GitHub,
  choosing another repository or installation, deleting the project or the organization all call
  `wipeFixCode` in the same transaction as the change. A fix without a pull request is deleted;
  one with a pull request keeps its row and link and loses its code. Checked against the real
  database by `apps/api/scripts/verify-fix-wipe.ts`, including 120 saves racing a switch-off.
- **A refusal of the model is an answer.** It is stored (no edits, a reason) and costs the slot.
  A patch that does not fit the code is not: 502, nothing stored, slot given back.
- **Only code files**: `.ts .tsx .js .jsx .mjs .cjs .mts .cts`, never dotfiles, configuration,
  declarations, tests or dependencies, and those files are not even shown to the model.

## Opening the pull request (step 5)

`POST /v1/organizations/:orgId/projects/:projectId/issues/:issueId/fix/:fixId/pull-request`,
owners and admins only, no body: the change is the one in the database, never one from the
request. Calling it again returns the same pull request.

In this order:
1. Tenant scope, then "already has a pull request" (returned as it is, whatever the settings are
   now), then the switches, the connection and the repository the fix was made for.
2. **Claim** (`updateMany`, like the claim on a GitHub issue, 120 s): one concurrent request wins,
   and the settings are part of the `where`, so a fix whose consent was withdrawn cannot be claimed.
3. On the default branch **as it is now**: every edit is applied again to the exact text of its
   file (byte order mark and line endings kept, mode kept). The text must still match, exactly
   once. Symlinks, submodules, binary files, bytes that are not UTF-8, files over 512 KB and files
   a fix may not touch are refused, and so is a replacement that writes a scrubber placeholder.
4. Blob, tree (on the tree of the default branch), then the **last consent check**, then commit
   and branch `errwise/fix-<fixId>`, then a **draft** pull request.
5. The link is saved, the claim ends, one audit entry (`fix.pull_request_opened`: repository and
   pull request number only).

What makes a repeat or a crash safe:
- Blobs and trees are content-addressed, so making them again changes nothing.
- A branch is never moved, overwritten or force-pushed. If `errwise/fix-<fixId>` exists, it is used
  only when its tree is exactly the tree this call would make; anything else is somebody's work and
  the answer is 409. Its pull request, if any, is adopted.
- Where GitHub offers no drafts (some private repositories), the answer is 409 and the branch this
  call made is deleted. A normal pull request is never the fallback: a draft is what keeps an
  auto-merge bot from merging AI code.
- Every failure gives the claim back, and the original error is never hidden by the release.

What goes into the text (`fix-pull-request-content.ts`, a pure function):
- The commit message is fixed text and a link: nothing the model wrote, so it cannot carry
  `Fixes #1`, a mention or a ping.
- The title is the model's, with `#`, `@`, backticks, `<>` and control characters removed.
- The explanation is only inside a fenced `text` block, longer than any run of backticks inside it.
- Warnings use our own sentences (a fixed vocabulary), never text taken from the code.
- `Fixes #N` is written only when the stored GitHub issue link belongs to **this** repository:
  after a project is reconnected elsewhere, `#12` could be any issue there.

**GitHub App.** Opening a pull request needs the repository permissions **Contents: Read and
write** and **Pull requests: Read and write**, which every installation owner must accept at
github.com/settings/installations. Until then every other feature keeps working with its own
narrower token (step 1), and this one answers 409 with that instruction.

## What was checked against GitHub

Tried by hand on 2026-11-23 on a throwaway repository with one file and one deliberate bug:
the error was reported with its commit, the stack trace showed the code from GitHub, the model
proposed the right guard, the diff was read in the dashboard, and the draft pull request was
opened. Before the new App permissions were accepted, opening it answered with the explanation
that the installation had not accepted them, and nothing was pushed.

One trap found on the way, worth knowing: the file that runs must be **byte for byte** the file
at the commit that is reported. A copy with the old code commented out above it moved the failing
line from 82 to 187, GitHub's file has 104 lines, and the dashboard (rightly) showed "file differs"
and no fix. The SDK reports the commit of the environment, not a check of the files.

**Still not confirmed against real GitHub** (the code handles each case, tested against the
documented API only): whether a refused token request answered `422` or the write answered `403`
(both give the same message), the exact wording of the `422` for "draft pull requests are not
supported" (a private repository on a plan without drafts) and for "a pull request already
exists", and which author GitHub shows on a commit made with an installation token. Check the
wording the first time you meet one of these, and adjust `createPullRequest` if it differs.

## The dashboard (step 6)

- **Issue page.** A card under the AI analysis (`features/fixes`). Only for projects that turned the
  feature on; an owner of a project that has source code on but not fixes sees one line pointing to
  the settings, everyone else sees nothing. States: ask for a fix, working, an error with a retry,
  "no safe change" with the model's reason, the change to review, the pull request opened, and
  "code no longer kept" (a switch was turned off) with the pull request link if there is one.
- **The diff is the main control**, because it is the last thing a human reads before a branch is
  pushed. It shows whole lines, not only the matched text: the API stores the rest of the first and
  last line next to each edit (`prefix` and `suffix`, scrubbed, so a secret that shares the line
  never reaches the dashboard). Lines that did not change are context.
- **Everything the model or the repository wrote is text.** React text nodes only: no HTML, no
  markdown, no links. A link that is followed (the pull request, the commit) must start with
  `https://github.com/`. Warnings use our own sentences.
- **Opening the pull request** is for owners and admins (`fix.openPullRequest`, the API enforces
  it) and goes through a dialog that says the branch will run the repository's CI, maybe with its
  secrets, and asks for "I have read the change above" before the button works. Members read the
  diff and are told who can open it.
- **Settings** (`FixPullRequestsCard`, owner only, on the integrations page): needs GitHub
  connected and source code on, lists what the feature does and what it needs from the GitHub App,
  and the source code card says that turning it off turns this off too.
- Checked without a browser: the pure logic (diff, links, error text) and the rendered markup of
  every state with hostile fixtures, outside the repository. The web app has no test runner yet.

## Known limits of the model

First eval of `fix-v1` with `gpt-oss-120b` (12 hand-made bugs, one sample each): 8 of 8 fixable
bugs fixed, the prompt-injection case fixed without adding what the message asked for, 2 of 3
refusals. The miss: for `connect ECONNREFUSED 127.0.0.1:5432` it removed a `|| '127.0.0.1'`
fallback, which changes nothing (`pg` defaults to localhost), instead of declining. So an
environment problem can still come back as a plausible patch. The diff review before the push is
the control for that, and the dashboard must present confidence as the model's opinion, never as
a promise. More refusal cases belong in `apps/ai/evals/fix_cases.py` before the prompt is tuned.

## Alternatives considered

- **Unscoped installation tokens:** simplest, but Contents: write would reach every code path.
- **Ask the model for a unified diff:** wrong line numbers make most patches fail to apply.
- **Do not store, keep the fix in memory:** the second click often lands on another serverless
  instance, so the fix would be lost and paid for twice.
- **Open the PR directly, without a diff step:** one click, but nobody reads the code before
  customer CI runs it.
- **A GitHub issue assigned to Copilot:** no code of our own, but no control over the result.

## Open points

- Which status GitHub gives for a permission an installation has not accepted: `422` on the
  token request (expected for reads, handled in `GithubApiClient.read()`) or `403` on a write
  (handled in `fixRequest`). Both end in the same message. Note it the first time it is seen.
- Draft pull requests on private repositories of plans without them: the answer is a clear 409
  and no normal pull request. Not seen yet; confirm the wording when it is.
- The web app has no test runner. The diff, the links and the escaping were checked with throwaway
  scripts (outside the repository). Adding one needs a new dev dependency, so it needs a decision.
- No `pull_request` webhook: a pull request merged or closed on GitHub does not change the fix.
- `next build` stops on a security advisory for the installed Next.js (16.4.0) before finishing.
  Unrelated to this feature, but it blocks a production build until the version is reviewed.
