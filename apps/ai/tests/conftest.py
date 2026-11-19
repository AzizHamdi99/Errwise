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
    values: dict[str, object] = {
        "ai_service_secret": SECRET,
        "llm_api_key": "test-llm-key",
        "llm_model": "test-model",
    }
    return Settings(**(values | overrides))  # type: ignore[arg-type]


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
