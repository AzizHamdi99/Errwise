import logging

import httpx
from pydantic import ValidationError

from app.analysis.errors import LLMBadResponse
from app.core.config import Settings
from app.fixes.edits import find_edit_problem
from app.fixes.prompts import FIX_PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.llm.client import StructuredChatClient
from app.llm.schema import strict_json_schema
from app.schemas.fix import FixOutput, FixRequest, FixResponse

logger = logging.getLogger(__name__)


class GroqFixProposer:
    """Asks an OpenAI-compatible chat endpoint for a patch, as strict structured output."""

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._model = settings.llm_fix_model or settings.llm_model
        self._max_output_tokens = settings.llm_fix_max_output_tokens
        self._chat = StructuredChatClient(settings, transport)
        self._schema = strict_json_schema(FixOutput)

    async def propose(self, request: FixRequest) -> FixResponse:
        content = await self._chat.complete(
            model=self._model,
            system=SYSTEM_PROMPT,
            user=build_user_prompt(request),
            schema_name="code_fix",
            schema=self._schema,
            max_output_tokens=self._max_output_tokens,
        )
        output = self._parse(content)
        problem = find_edit_problem(request, output)
        if problem:
            # The model wrote edits that do not fit the code it was given: an unusable answer.
            logger.warning("llm edits rejected: %s", problem)
            raise LLMBadResponse
        return FixResponse(
            **output.model_dump(),
            prompt_version=FIX_PROMPT_VERSION,
            model=self._model,
        )

    @staticmethod
    def _parse(content: str) -> FixOutput:
        try:
            return FixOutput.model_validate_json(content)
        except ValidationError as error:
            logger.warning("llm output rejected: %d validation errors", error.error_count())
            raise LLMBadResponse from error
