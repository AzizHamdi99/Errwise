from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.analysis.base import Analyzer
from app.analysis.stub import StubAnalyzer
from app.api.deps import get_analyzer
from app.core.config import Settings, get_settings
from app.main import create_app

SECRET = "test-secret-at-least-16-chars"


def make_settings(**overrides: object) -> Settings:
    # Every setting a test relies on is pinned, and the developer's .env is not read: otherwise a
    # model or a budget set there would change what the tests see.
    values: dict[str, object] = {
        "ai_service_secret": SECRET,
        "llm_api_key": "test-llm-key",
        "llm_model": "test-model",
        "llm_base_url": "https://api.groq.com/openai/v1",
        "llm_max_output_tokens": 1_500,
        "llm_fix_model": None,
        "llm_fix_max_output_tokens": 2_500,
    }
    return Settings(_env_file=None, **(values | overrides))  # type: ignore[arg-type, call-arg]


@pytest.fixture
def make_client() -> Callable[..., TestClient]:
    """Builds a client with a chosen analyzer. The default is the offline stub."""

    def build(analyzer: Analyzer | None = None) -> TestClient:
        app = create_app()
        # A lambda, not make_settings itself: FastAPI would read its **overrides as a parameter.
        app.dependency_overrides[get_settings] = lambda: make_settings()
        app.dependency_overrides[get_analyzer] = lambda: analyzer or StubAnalyzer()
        return TestClient(app)

    return build


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()


@pytest.fixture
def auth() -> dict[str, str]:
    return {"x-ai-secret": SECRET}
