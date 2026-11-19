from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.analysis.errors import LLMBadResponse, LLMRateLimited, LLMTimeout
from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse

PAYLOAD = {
    "type": "TypeError",
    "message": "Cannot read properties of undefined (reading 'name')",
    "stack": (
        "TypeError: Cannot read properties of undefined\n"
        "    at getUser (/app/src/users.js:10:5)\n"
        "    at handler (/app/src/routes.js:22:3)\n"
        "    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)\n"
        "    at next (/app/node_modules/express/lib/router/route.js:149:13)"
    ),
    "environment": "production",
    "release": "1.4.0",
    "runtime": "node 22",
}


def test_rejects_a_missing_secret(client: TestClient) -> None:
    assert client.post("/analyze", json=PAYLOAD).status_code == 401


def test_rejects_a_wrong_secret(client: TestClient) -> None:
    response = client.post("/analyze", json=PAYLOAD, headers={"x-ai-secret": "nope"})
    assert response.status_code == 401


def test_returns_a_camel_case_analysis(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post("/analyze", json=PAYLOAD, headers=auth)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "summary",
        "probableCause",
        "suggestedFix",
        "confidence",
        "framesUsed",
        "promptVersion",
        "model",
    }
    assert body["confidence"] in {"low", "medium", "high"}
    assert body["framesUsed"][0] == "at getUser (/app/src/users.js:10:5)"
    assert len(body["framesUsed"]) == 3


def test_stack_is_optional(client: TestClient, auth: dict[str, str]) -> None:
    payload = {k: v for k, v in PAYLOAD.items() if k != "stack"}
    response = client.post("/analyze", json=payload, headers=auth)
    assert response.status_code == 200
    assert response.json()["framesUsed"] == []


def test_unknown_fields_are_a_contract_error(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post("/analyze", json={**PAYLOAD, "projectId": "x"}, headers=auth)
    assert response.status_code == 422


def test_oversized_message_is_rejected(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post("/analyze", json={**PAYLOAD, "message": "x" * 5_001}, headers=auth)
    assert response.status_code == 422


def test_secret_is_checked_before_the_body(client: TestClient) -> None:
    response = client.post("/analyze", json={"nonsense": True})
    assert response.status_code == 401


class _Failing:
    def __init__(self, error: Exception) -> None:
        self._error = error

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        raise self._error


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (LLMRateLimited(), 503, "llm_rate_limited"),
        (LLMTimeout(), 504, "llm_timeout"),
        (LLMBadResponse(), 502, "llm_bad_response"),
    ],
)
def test_provider_failures_become_short_codes(
    make_client: Callable[..., TestClient],
    auth: dict[str, str],
    error: Exception,
    status: int,
    code: str,
) -> None:
    response = make_client(_Failing(error)).post("/analyze", json=PAYLOAD, headers=auth)
    assert response.status_code == status
    assert response.json() == {"detail": code}
