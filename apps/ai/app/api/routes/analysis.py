from typing import Annotated

from fastapi import APIRouter, Depends

from app.analysis.base import Analyzer
from app.api.deps import get_analyzer
from app.core.security import require_secret
from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse

router = APIRouter(tags=["analysis"], dependencies=[Depends(require_secret)])


@router.post("/analyze", response_model_by_alias=True)
async def analyze(
    request: AnalyzeRequest,
    analyzer: Annotated[Analyzer, Depends(get_analyzer)],
) -> AnalyzeResponse:
    return await analyzer.analyze(request)
