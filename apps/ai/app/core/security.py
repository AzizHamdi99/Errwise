import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def require_secret(
    settings: Annotated[Settings, Depends(get_settings)],
    x_ai_secret: Annotated[str | None, Header()] = None,
) -> None:
    """Only the Errwise API may call this service. Compared in constant time."""
    expected = settings.ai_service_secret.get_secret_value()
    if x_ai_secret is None or not hmac.compare_digest(x_ai_secret, expected):
        # Same answer for "missing" and "wrong": nothing to learn from it.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")
