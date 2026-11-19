from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.common import CamelModel

# Same limits as eventSchema in packages/shared/src/events.ts.
MAX_MESSAGE = 5_000
MAX_STACK = 50_000


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


class AnalyzeResponse(AnalysisOutput):
    """What the Errwise API receives and stores."""

    prompt_version: str
    model: str
