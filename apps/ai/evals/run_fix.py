"""Runs the fix cases against the real provider and prints how each one went.

    uv run python -m evals.run_fix                # every case
    uv run python -m evals.run_fix --only missing-await
    uv run python -m evals.run_fix --pause 45     # seconds between calls
    uv run python -m evals.run_fix --only X --show   # also print the answer (synthetic code)

It uses the settings of apps/ai/.env (LLM_API_KEY, LLM_FIX_MODEL...) and prints no code, no
prompt and no key, unless --show asks for the answer (the cases are synthetic). The free plan
allows 8,000 tokens a minute, so the default pause keeps one call per minute window. Run it
when the prompt or the model changes, and read the table: it is a smoke test, not a benchmark
(one sample per case, the model is not deterministic).
"""

import argparse
import asyncio
import sys
from dataclasses import dataclass

from app.analysis.errors import AnalysisError, LLMRateLimited, LLMTooLarge
from app.core.config import get_settings
from app.fixes.edits import apply_edits
from app.fixes.groq import GroqFixProposer
from app.fixes.prompts import FIX_PROMPT_VERSION
from app.schemas.fix import FixResponse
from evals.fix_cases import CASES, FixCase

RATE_LIMIT_RETRIES = 2
RATE_LIMIT_WAIT_SECONDS = 60


@dataclass
class Outcome:
    name: str
    verdict: str  # "pass" or "fail"
    detail: str


def judge(case: FixCase, answer: FixResponse) -> Outcome:
    """What the answer did, in one word and one reason."""
    if not case.expect_fixable:
        if answer.fixable:
            return Outcome(case.name, "fail", "proposed a fix where there is none")
        return Outcome(case.name, "pass", "declined")

    if not answer.fixable:
        return Outcome(case.name, "fail", f"declined: {answer.reason[:80]}")
    window = case.request.files[0]
    patched = apply_edits(window.code, answer.edits)
    if case.check is not None and not case.check(patched):
        return Outcome(case.name, "fail", "valid patch, but the bug is not fixed")
    return Outcome(case.name, "pass", f"fixed, {answer.confidence} confidence")


def show(answer: FixResponse) -> None:
    print(f"      explanation: {answer.explanation or '-'}")
    print(f"      reason: {answer.reason or '-'}")
    for edit in answer.edits:
        print(f"      {edit.file}")
        print(f"      - {edit.search!r}")
        print(f"      + {edit.replace!r}")


async def run_case(proposer: GroqFixProposer, case: FixCase, *, verbose: bool) -> Outcome:
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        try:
            answer = await proposer.propose(case.request)
            if verbose:
                show(answer)
            return judge(case, answer)
        except LLMRateLimited:
            if attempt == RATE_LIMIT_RETRIES:
                return Outcome(case.name, "fail", "rate limited, gave up")
            await asyncio.sleep(RATE_LIMIT_WAIT_SECONDS)
        except LLMTooLarge:
            return Outcome(case.name, "fail", "request too large for the provider")
        except AnalysisError as error:
            # Includes edits that do not fit the code: counted as an invalid patch.
            return Outcome(case.name, "fail", f"unusable answer ({error.code})")
    return Outcome(case.name, "fail", "unreachable")


async def main(only: str | None, pause: float, *, verbose: bool) -> int:
    cases = [c for c in CASES if only in (None, c.name)]
    if not cases:
        print(f"No case named {only!r}.")
        return 2

    settings = get_settings()
    proposer = GroqFixProposer(settings)
    model = settings.llm_fix_model or settings.llm_model
    print(f"model {model}, prompt {FIX_PROMPT_VERSION}, {len(cases)} cases\n")

    outcomes: list[Outcome] = []
    for index, case in enumerate(cases):
        if index:
            await asyncio.sleep(pause)
        outcome = await run_case(proposer, case, verbose=verbose)
        outcomes.append(outcome)
        print(f"{outcome.verdict.upper():5} {outcome.name:24} {outcome.detail}", flush=True)

    passed = sum(o.verdict == "pass" for o in outcomes)
    print(f"\n{passed}/{len(outcomes)} as expected")
    return 0 if passed == len(outcomes) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="run a single case by name")
    parser.add_argument("--pause", type=float, default=40.0, help="seconds between calls")
    parser.add_argument("--show", action="store_true", help="print each answer")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.only, args.pause, verbose=args.show)))
