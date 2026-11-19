from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse

MAX_FRAMES = 3


class StubAnalyzer:
    """Deterministic fake. Proves hosting, auth and the API contract before any LLM exists."""

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        frames = [
            line.strip()
            for line in (request.stack or "").splitlines()
            if line.strip().startswith("at ")
        ][:MAX_FRAMES]
        return AnalyzeResponse(
            summary=f"{request.type}: {request.message[:120]}",
            probable_cause="Stub analysis. No model was called.",
            suggested_fix="Stub analysis. No model was called.",
            confidence="low",
            frames_used=frames,
            prompt_version="stub",
            model="stub",
        )
