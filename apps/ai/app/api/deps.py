from typing import Annotated

from fastapi import Depends

from app.analysis.base import Analyzer
from app.analysis.groq import GroqAnalyzer
from app.core.config import Settings, get_settings
from app.fixes.base import FixProposer
from app.fixes.groq import GroqFixProposer


def get_analyzer(settings: Annotated[Settings, Depends(get_settings)]) -> Analyzer:
    """The single place that decides which analyzer runs. Tests override it."""
    return GroqAnalyzer(settings)


def get_fix_proposer(settings: Annotated[Settings, Depends(get_settings)]) -> FixProposer:
    """Same idea for fixes: the single place that decides which proposer runs."""
    return GroqFixProposer(settings)
