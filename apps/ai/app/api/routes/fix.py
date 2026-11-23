from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_fix_proposer
from app.core.security import require_secret
from app.fixes.base import FixProposer
from app.schemas.fix import FixRequest, FixResponse

router = APIRouter(tags=["fix"], dependencies=[Depends(require_secret)])


@router.post("/fix", response_model_by_alias=True)
async def fix(
    request: FixRequest,
    proposer: Annotated[FixProposer, Depends(get_fix_proposer)],
) -> FixResponse:
    return await proposer.propose(request)
