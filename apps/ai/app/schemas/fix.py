from typing import Literal, Self

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import CamelModel

# Same limits as packages/shared/src/fixes.ts. A change there must be made here too.
MAX_FILES = 3
MAX_EDITS = 5
MAX_WINDOW_CODE = 4_000
MAX_TOTAL_CODE = 10_000


class CodeWindow(CamelModel):
    """The raw lines around one failing frame, read from the project's repository.

    No line numbers inside `code`: the model copies text from it, and a prefix would never match
    the file. The numbers are given beside it.
    """

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    file: str = Field(min_length=1, max_length=500)
    start_line: int = Field(ge=1)  # number of the first line of `code`
    failing_line: int = Field(ge=1)
    code: str = Field(min_length=1, max_length=MAX_WINDOW_CODE)

    @model_validator(mode="after")
    def _failing_line_is_in_the_window(self) -> Self:
        if self.failing_line < self.start_line:
            raise ValueError("failingLine is before startLine")
        return self


class FixRequest(CamelModel):
    """What the Errwise API sends. Already scrubbed, like AnalyzeRequest."""

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    type: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5_000)
    stack: str | None = Field(default=None, max_length=50_000)
    environment: str = Field(min_length=1, max_length=64)
    release: str | None = Field(default=None, max_length=128)
    runtime: str | None = Field(default=None, max_length=64)
    files: list[CodeWindow] = Field(min_length=1, max_length=MAX_FILES)

    @model_validator(mode="after")
    def _files_are_distinct_and_fit_the_budget(self) -> Self:
        if len({window.file for window in self.files}) != len(self.files):
            raise ValueError("one window per file")
        if sum(len(window.code) for window in self.files) > MAX_TOTAL_CODE:
            raise ValueError("too much code for one request")
        return self


class FixEdit(CamelModel):
    """Replace the one occurrence of `search` in `file` with `replace`."""

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    file: str = Field(
        min_length=1,
        max_length=500,
        description="The path exactly as given in the file tag of the source code.",
    )
    search: str = Field(
        min_length=1,
        max_length=2_000,
        description=(
            "Text copied verbatim from the code, same whitespace, occurring exactly once "
            "in that file."
        ),
    )
    replace: str = Field(
        max_length=2_000,
        description="What goes in its place, with the same indentation. May be empty.",
    )


class FixOutput(CamelModel):
    """What the model must produce. Also the source of the strict JSON schema sent to it.

    Every field is required and extra fields are forbidden, as strict structured outputs
    demand. The length limits and the rule below are checked after the call, not by the model.
    """

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    fixable: bool = Field(
        description="True only when the code shown allows a safe fix of a few lines."
    )
    pr_title: str = Field(
        max_length=120,
        description="Short imperative title, plain text. Empty when not fixable.",
    )
    explanation: str = Field(
        max_length=1_500,
        description="What was wrong and what the change does, plain text. Empty when not fixable.",
    )
    confidence: Literal["low", "medium", "high"] = Field(
        description="How sure you are that the change fixes this error, given the evidence."
    )
    edits: list[FixEdit] = Field(
        max_length=MAX_EDITS,
        description="The changes. Empty when not fixable.",
    )
    reason: str = Field(
        max_length=500,
        description="Why there is no code fix, in one or two plain sentences. Empty when fixable.",
    )

    @model_validator(mode="after")
    def _answer_matches_its_flag(self) -> Self:
        if self.fixable:
            complete = self.pr_title.strip() and self.explanation.strip() and self.edits
            if not complete:
                raise ValueError("a fixable answer needs a title, an explanation and edits")
        elif self.edits or not self.reason.strip():
            raise ValueError("a refusal needs a reason and no edits")
        return self


class FixResponse(FixOutput):
    """What the Errwise API receives and stores."""

    prompt_version: str
    model: str
