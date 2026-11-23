from typing import Protocol

from app.schemas.fix import FixRequest, FixResponse


class FixProposer(Protocol):
    """The seam of the fix feature, like `Analyzer` for analysis.

    The route only knows this interface. A plain LLM call, a chain, or an agent that reads more
    of the repository are each a new class plus one line in `api/deps.py`.
    """

    async def propose(self, request: FixRequest) -> FixResponse: ...
