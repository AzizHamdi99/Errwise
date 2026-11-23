import logging
from typing import Any

import httpx

from app.analysis.errors import LLMBadResponse, LLMRateLimited, LLMTimeout, LLMTooLarge
from app.core.config import Settings

logger = logging.getLogger(__name__)


class StructuredChatClient:
    """One call to an OpenAI-compatible chat endpoint with strict structured outputs.

    It only moves text: prompts and parsing belong to the analyzer or proposer that uses it.
    Never logs the request, the answer or the key.
    """

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._transport = transport  # tests inject httpx.MockTransport

    async def complete(
        self,
        *,
        model: str,
        system: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        max_output_tokens: int,
    ) -> str:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
            "reasoning_effort": "low",
            "max_completion_tokens": max_output_tokens,
        }
        return await self._post(body)

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
        if response.status_code == httpx.codes.REQUEST_ENTITY_TOO_LARGE:
            # The provider counts the request against a per-minute token limit.
            raise LLMTooLarge
        if response.status_code != httpx.codes.OK:
            logger.warning("llm returned status %s", response.status_code)
            raise LLMBadResponse
        return _extract_content(response)


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
