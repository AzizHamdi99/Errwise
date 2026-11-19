# ADR-004: AI root-cause analysis as a separate, stateless service

Status: Accepted
Date: 2026-11-19

## Context

Developers open an issue and have to work out from a stack trace what went wrong. An LLM can
summarize the error, suggest a probable cause and a fix. This needs three things Errwise did not
have: a place to run Python (the author's goal is AI engineering), protection of the data that
leaves for a third party, and a cost cap, because the budget is close to zero.

## Decision

**A separate Python service, `apps/ai` (FastAPI), that never touches the database.**
- The API loads the issue and its latest event (tenant-scoped), builds a small input, and calls
  `POST /analyze` with the header `x-ai-secret` (constant-time compare). The service calls the
  LLM and answers. The API validates the answer with Zod and stores it.
- Only the API touches Postgres, so tenant isolation stays in one place and the Python service
  is stateless and easy to host or replace.
- The contract is a Zod schema in `packages/shared/src/analysis.ts` and a Pydantic model in
  `apps/ai/app/schemas/analysis.py`. The Python side rejects unknown fields (`422`).

**Privacy: scrub, then send.**
- Ingestion scrubs every event (`common/utils/scrub.ts`): emails, bearer tokens, JWTs, provider
  keys, card numbers (Luhn-checked), URL credentials, and sensitive keys in `context`.
- The analysis input is scrubbed again, because events stored before scrubbing existed are not
  clean. Only `type`, `message`, `stack`, `environment`, `release` and the node version go out.
  The free-form `context` never does.
- The fingerprint is computed from the original text, so scrubbing never changes how errors are
  grouped. (Note: emails in messages already split issues before this change. Adding an email
  placeholder to `normalizeMessage` would be a fingerprint v2.)

**Strict structured outputs and untrusted input.**
- The model must answer with a JSON schema (`strict: true`, every field required,
  `additionalProperties: false`), generated from the same Pydantic model that validates the
  answer. Size limits are checked after the call.
- The error text is untrusted (anyone with an ingest key can write it). It is placed in a
  delimited block, the system prompt says it is data, any closing tag inside it is neutralized,
  the model has no tools, and frames the model cites that are not in the stack are dropped.
- The dashboard shows the result as plain text: no HTML, no markdown, no links.

**Cost control.**
- Manual trigger only (a button), never automatic.
- One stored analysis per `(issueId, inputHash)`. The hash covers the scrubbed input and a cache
  version (`ANALYSIS_CACHE_VERSION`). A repeat for the same error is free and works even if the
  AI service is down.
- A per-organization daily allowance (`AI_DAILY_LIMIT_PER_ORG`, default 20) in `AiUsage`, reserved
  with one atomic `updateMany ... where requests < limit`, so parallel requests cannot exceed it.
  A failed call gives its slot back.
- Provider rate limits become a friendly `503 "AI is busy"`, never a `500`.

**Provider and hosting.**
- Groq's free tier with `openai/gpt-oss-20b`, through its OpenAI-compatible API, so a provider
  change is configuration (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`).
- `apps/ai` runs as its own Vercel project (root directory `apps/ai`). It only makes HTTP calls,
  so there is no large bundle. The API stays off the feature until `AI_SERVICE_URL` and
  `AI_SERVICE_SECRET` are both set, so the code can ship before the service does.

**Extensibility.** Routes only know the `Analyzer` protocol (`apps/ai/app/analysis/base.py`).
A LangChain chain or a LangGraph graph is one more class plus one line in `api/deps.py`.

## Consequences

- Two new tables, additive only: `IssueAnalysis` and `AiUsage`. Deploy order is unchanged:
  migrate production first, then deploy.
- Changing the prompt means bumping `PROMPT_VERSION` in `apps/ai` and `ANALYSIS_CACHE_VERSION`
  in the API together, otherwise old analyses keep being served.
- Two simultaneous first requests for the same input can both call the model. Only one result is
  stored, and the daily allowance bounds the waste.
- Free-tier limits are shared by all organizations. Under load, users see "AI is busy".
- Analysis quality is limited by the SDK data (no breadcrumbs or user context yet) and by the
  lack of source code in the prompt.

## Alternatives considered

- **Call the LLM directly from the NestJS API:** fastest to ship, but it delays the Python goal
  and would make the API grow an AI client with no clear boundary.
- **Let the Python service read Postgres:** simpler queries, but it splits tenant isolation
  across two codebases and needs database credentials in a third deployment.
- **Automatic analysis on every new issue:** better first impression, but costs are harder to
  cap on a free tier. It can come later, behind the queue, with its own limit.
- **Scrub only in the SDK:** the SDK is untrusted and old versions stay in production.
