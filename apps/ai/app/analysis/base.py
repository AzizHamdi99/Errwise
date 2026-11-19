from typing import Protocol

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse


class Analyzer(Protocol):
    """The one seam of the service.

    The route only knows this interface. A plain LLM call, a LangChain chain or a
    LangGraph graph are all just different implementations of `analyze`.
    """

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse: ...
