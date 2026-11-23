from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated at startup, like apps/api/src/config/env.ts. A missing value stops the app."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared with the NestJS API (AI_SERVICE_SECRET). The only authentication of this service.
    ai_service_secret: SecretStr = Field(min_length=16)

    # Any OpenAI-compatible provider. Groq today, a swap is a config change.
    llm_api_key: SecretStr = Field(min_length=1)
    llm_model: str = Field(min_length=1)
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_timeout_seconds: float = Field(default=30.0, gt=0, le=120)
    llm_max_output_tokens: int = Field(default=1_500, gt=0, le=8_000)

    # Fix suggestions write code, so they may use a stronger model (ADR-009). Falls back to
    # llm_model. The output budget is the free plan's 8,000 tokens a minute minus the prompt.
    llm_fix_model: str | None = None
    llm_fix_max_output_tokens: int = Field(default=2_500, gt=0, le=8_000)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
