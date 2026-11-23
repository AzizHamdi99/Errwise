class AnalysisError(Exception):
    """Base for failures the API should treat as "AI unavailable". `code` is safe to return."""

    code = "analysis_failed"
    status_code = 502


class LLMRateLimited(AnalysisError):
    code = "llm_rate_limited"
    status_code = 503


class LLMTimeout(AnalysisError):
    code = "llm_timeout"
    status_code = 504


class LLMBadResponse(AnalysisError):
    """The provider failed or returned something that is not the agreed JSON."""

    code = "llm_bad_response"
    status_code = 502


class LLMTooLarge(AnalysisError):
    """The request is bigger than the provider accepts right now (per-minute token limit)."""

    code = "llm_too_large"
    status_code = 413
