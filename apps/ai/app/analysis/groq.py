import logging

import httpx
from pydantic import ValidationError

from app.analysis.errors import LLMBadResponse
from app.analysis.prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.core.config import Settings
from app.llm.client import StructuredChatClient
from app.llm.schema import strict_json_schema
from app.schemas.analysis import AnalysisOutput, AnalyzeRequest, AnalyzeResponse

logger = logging.getLogger(__name__)

__all__ = ["GroqAnalyzer", "strict_json_schema"]


class GroqAnalyzer:
    """Calls an OpenAI-compatible chat endpoint with strict structured outputs."""

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._chat = StructuredChatClient(settings, transport)
        self._schema = strict_json_schema(AnalysisOutput)

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        content = await self._chat.complete(
            model=self._settings.llm_model,
            system=SYSTEM_PROMPT,
            user=build_user_prompt(request),
            schema_name="issue_analysis",
            schema=self._schema,
            max_output_tokens=self._settings.llm_max_output_tokens,
        )
        output = self._parse(content)
        return AnalyzeResponse(
            **output.model_dump(exclude={"frames_used"}),
            frames_used=_keep_real_frames(output.frames_used, request.stack),
            prompt_version=PROMPT_VERSION,
            model=self._settings.llm_model,
        )

    @staticmethod
    def _parse(content: str) -> AnalysisOutput:
        try:
            return AnalysisOutput.model_validate_json(content)
        except ValidationError as error:
            logger.warning("llm output rejected: %d validation errors", error.error_count())
            raise LLMBadResponse from error


def _keep_real_frames(frames: list[str], stack: str | None) -> list[str]:
    """The model may not invent evidence: keep only lines that really are in the stack."""
    if not stack:
        return []
    real = {line.strip() for line in stack.splitlines()}
    return [frame.strip() for frame in frames if frame.strip() in real]
