from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.analysis.errors import AnalysisError
from app.api.routes import analysis, health


async def analysis_error_handler(_: Request, error: Exception) -> JSONResponse:
    # Only a short code leaves the service: never provider messages, payloads or keys.
    if not isinstance(error, AnalysisError):
        raise error
    return JSONResponse(status_code=error.status_code, content={"detail": error.code})


def create_app() -> FastAPI:
    # Interactive docs are off: this is an internal service, not a public API.
    app = FastAPI(title="Errwise AI", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_exception_handler(AnalysisError, analysis_error_handler)
    app.include_router(health.router)
    app.include_router(analysis.router)
    return app


app = create_app()
