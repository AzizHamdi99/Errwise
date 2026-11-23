# Errwise AI service

Stateless FastAPI service that analyzes error events. The Errwise API calls it with an already
scrubbed event and stores the result. **This service never touches the database.**

## Layout

```
app/
  main.py              create_app(): wires routers
  core/                config (env validation), security (shared secret)
  api/
    deps.py            get_analyzer(), get_fix_proposer(): the one place that picks the implementation
    routes/            thin HTTP layer: health, analysis, fix
  schemas/             Pydantic contract (camelCase on the wire, snake_case in Python)
  analysis/
    base.py            Analyzer protocol: the seam
    groq.py            GroqAnalyzer: strict structured outputs over an OpenAI-compatible API
    prompts.py         system prompt, untrusted-data block, PROMPT_VERSION
    errors.py          failures mapped to short codes (503 rate limit, 504 timeout, 502 bad output)
    stub.py            deterministic fake, handy offline
  llm/
    client.py          StructuredChatClient: one strict structured-output call, shared by both features
    schema.py          strict_json_schema(): Pydantic model to the provider's strict JSON schema
  fixes/               code fix suggestions (ADR-009), same shape as analysis/
    base.py            FixProposer protocol
    groq.py            GroqFixProposer, checks that its edits fit the code it was given
    prompts.py         system prompt, untrusted-data blocks, FIX_PROMPT_VERSION
    edits.py           find_edit_problem(), apply_edits()
    stub.py            deterministic fake
evals/                 12 hand-made bugs and a runner for the real provider (not run in CI)
tests/                 the LLM is faked with httpx.MockTransport, no network needed
```

Safety rules in `groq.py` and `prompts.py`: the error text is delimited and declared untrusted,
the model must answer with a strict JSON schema, Pydantic validates it again, and frames the model
cites that are not in the stack are dropped. Bump `PROMPT_VERSION` whenever the prompt changes.

Rule: routes only know the `Analyzer` protocol. A plain LLM call, a LangChain chain or a LangGraph
graph are each one new class in `app/analysis/` plus one line in `deps.py`. Nothing else changes.

## Run locally

Windows PowerShell, from `apps/ai`:

```
uv sync
copy .env.example .env        # then set AI_SERVICE_SECRET
uv run uvicorn app.main:app --reload --port 8000
```

```
curl http://localhost:8000/health
curl -X POST http://localhost:8000/analyze -H "x-ai-secret: <your secret>" -H "content-type: application/json" -d "{\"type\":\"TypeError\",\"message\":\"x\",\"environment\":\"production\"}"
```

## Checks

```
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

## Fix suggestions

`POST /fix` takes the error and up to three windows of the application's own code (raw text, no
line numbers, at most 10,000 characters in all) and answers either search/replace edits or a
refusal with a reason. `LLM_FIX_MODEL` picks the model (default `LLM_MODEL`). Edits that do not
fit the code that was sent answer `502`, and a provider token limit answers `413`.

```
uv run python -m evals.run_fix                 # real provider, one call every 40 s
uv run python -m evals.run_fix --only missing-await
```

Run the eval whenever the prompt or the model changes. It prints one line per case and no code.
Bump `FIX_PROMPT_VERSION` with the prompt.

## Contract

`POST /analyze` and `POST /fix`, header `x-ai-secret`. Request and response models are in
`app/schemas/analysis.py` and `app/schemas/fix.py` and must match the Zod schemas in
`packages/shared` (`analysis.ts`, `fixes.ts`). Unknown request
fields return `422` on purpose.
