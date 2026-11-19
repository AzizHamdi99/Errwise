from typing import Annotated

from fastapi import Depends

from app.analysis.base import Analyzer
from app.analysis.groq import GroqAnalyzer
from app.core.config import Settings, get_settings


def get_analyzer(settings: Annotated[Settings, Depends(get_settings)]) -> Analyzer:
    """The single place that decides which analyzer runs. Tests override it."""
    return GroqAnalyzer(settings)
