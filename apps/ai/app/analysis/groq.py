import logging
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.analysis.errors import LLMBadResponse, LLMRateLimited, LLMTimeout
from app.analysis.prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.core.config import Settings
from app.schemas.analysis import AnalysisOutput, AnalyzeRequest, AnalyzeResponse

logger = logging.getLogger(__name__)

# Keywords the provider's strict mode may reject. Pydantic enforces them after the call instead.
_UNSUPPORTED = {"title", "default", "minLength", "maxLength", "minItems", "maxItems"}


def strict_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """JSON schema for strict structured outputs: all fields required, no extra properties."""

    def clean(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: clean(v) for k, v in node.items() if k not in _UNSUPPORTED}
        if isinstance(node, list):
            return [clean(item) for item in node]
        return node

    schema: dict[str, Any] = clean(model.model_json_schema(by_alias=True))
    if schema.get("additionalProperties") is not False:
        raise ValueError(f"{model.__name__} must forbid extra fields")
    if set(schema.get("required", [])) != set(schema["properties"]):
        raise ValueError(f"{model.__name__} must require every field")
    return schema


class GroqAnalyzer:
    """Calls an OpenAI-compatible chat endpoint with strict structured outputs."""

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._transport = transport  # tests inject httpx.MockTransport
        self._schema = strict_json_schema(AnalysisOutput)

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        body = {
            "model": self._settings.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(request)},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "issue_analysis", "strict": True, "schema": self._schema},
            },
            "reasoning_effort": "low",
            "max_completion_tokens": self._settings.llm_max_output_tokens,
        }
        content = await self._post(body)
        output = self._parse(content)
        return AnalyzeResponse(
            **output.model_dump(exclude={"frames_used"}),
            frames_used=_keep_real_frames(output.frames_used, request.stack),
            prompt_version=PROMPT_VERSION,
            model=self._settings.llm_model,
        )

    async def _post(self, body: dict[str, Any]) -> str:
        url = f"{self._settings.llm_base_url.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {self._settings.llm_api_key.get_secret_value()}"}
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=httpx.Timeout(self._settings.llm_timeout_seconds),
            ) as client:
                response = await client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as error:
            raise LLMTimeout from error
        except httpx.HTTPError as error:
            # Log the error class only: messages can contain URLs, never the key or the payload.
            logger.warning("llm request failed: %s", type(error).__name__)
            raise LLMBadResponse from error

        if response.status_code == httpx.codes.TOO_MANY_REQUESTS:
            raise LLMRateLimited
        if response.status_code != httpx.codes.OK:
            logger.warning("llm returned status %s", response.status_code)
            raise LLMBadResponse
        return _extract_content(response)

    @staticmethod
    def _parse(content: str) -> AnalysisOutput:
        try:
            return AnalysisOutput.model_validate_json(content)
        except ValidationError as error:
            logger.warning("llm output rejected: %d validation errors", error.error_count())
            raise LLMBadResponse from error


def _extract_content(response: httpx.Response) -> str:
    try:
        choice = response.json()["choices"][0]
        if choice.get("finish_reason") == "length":
            logger.warning("llm output was cut off")
            raise LLMBadResponse
        content = choice["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as error:
        raise LLMBadResponse from error
    if not isinstance(content, str) or not content:
        raise LLMBadResponse
    return content


def _keep_real_frames(frames: list[str], stack: str | None) -> list[str]:
    """The model may not invent evidence: keep only lines that really are in the stack."""
    if not stack:
        return []
    real = {line.strip() for line in stack.splitlines()}
    return [frame.strip() for frame in frames if frame.strip() in real]
