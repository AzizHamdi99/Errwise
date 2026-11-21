from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.common import CamelModel

# Same limits as eventSchema in packages/shared/src/events.ts.
MAX_MESSAGE = 5_000
MAX_STACK = 50_000
# Same limits as analyzeRequestSchema in packages/shared/src/analysis.ts.
MAX_SNIPPETS = 5
MAX_SNIPPET_CODE = 2_000


class SourceSnippet(CamelModel):
    """The lines around one failing frame, read from the project's repository.

    `code` is already formatted by the API: one source line per line, each prefixed with its
    number, the failing line marked with ">". The service embeds it as it is.
    """

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    file: str = Field(min_length=1, max_length=500)
    line: int = Field(ge=1)
    code: str = Field(min_length=1, max_length=MAX_SNIPPET_CODE)


class AnalyzeRequest(CamelModel):
    """What the Errwise API sends. It is already scrubbed: this service never sees raw events."""

    # Unknown fields are a contract mismatch with the API, so fail loudly (422).
    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    type: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=MAX_MESSAGE)
    stack: str | None = Field(default=None, max_length=MAX_STACK)
    environment: str = Field(min_length=1, max_length=64)
    release: str | None = Field(default=None, max_length=128)
    runtime: str | None = Field(default=None, max_length=64)  # e.g. "node 22"
    # Only sent when the project opted in to showing its source code.
    source_context: list[SourceSnippet] | None = Field(default=None, max_length=MAX_SNIPPETS)


class AnalysisOutput(CamelModel):
    """What the model must produce. Also the source of the strict JSON schema sent to it.

    Every field is required and extra fields are forbidden, as strict structured
    outputs demand. The length limits are checked after the call, not by the model.
    """

    model_config = CamelModel.model_config | ConfigDict(extra="forbid")

    summary: str = Field(
        min_length=1,
        max_length=500,
        description="One or two plain sentences: what failed and where.",
    )
    probable_cause: str = Field(
        min_length=1,
        max_length=2_000,
        description="The most likely root cause, based only on the evidence given.",
    )
    suggested_fix: str = Field(
        min_length=1,
        max_length=2_000,
        description="A concrete next step for the developer. Say so if the evidence is not enough.",
    )
    confidence: Literal["low", "medium", "high"] = Field(
        description="low when the stack or message is too thin to be sure."
    )
    frames_used: list[str] = Field(
        max_length=10,
        description="Stack frames the analysis relies on, copied verbatim from the stack.",
    )
    issue_title: str = Field(
        min_length=1,
        max_length=120,
        description=(
            "A short title for a bug report: what is broken and where. Plain text, "
            "no error type prefix, no @mentions."
        ),
    )
    repro_steps: list[str] = Field(
        max_length=5,
        description=(
            "Likely steps to reproduce, one short plain sentence each. Empty list when the "
            "evidence does not show how to trigger the error."
        ),
    )


class AnalyzeResponse(AnalysisOutput):
    """What the Errwise API receives and stores."""

    prompt_version: str
    model: str
