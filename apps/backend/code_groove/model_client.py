from typing import Any

from google import genai
from google.genai import types

from code_groove.agent_limits import MODEL_HTTP_TIMEOUT_SECONDS
from code_groove.settings import Settings


def create_model_client(settings: Settings, credentials: Any = None) -> genai.Client:
    http = types.HttpOptions(
        api_version="v1",
        timeout=MODEL_HTTP_TIMEOUT_SECONDS * 1000,
        retry_options=types.HttpRetryOptions(attempts=1),
    )
    if settings.model_auth_mode == "adc":
        return genai.Client(
            enterprise=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
            credentials=credentials,
            http_options=http,
        )
    if not settings.google_cloud_api_key:
        raise RuntimeError("Express mode requires GOOGLE_CLOUD_API_KEY")
    return genai.Client(enterprise=True, api_key=settings.google_cloud_api_key, http_options=http)
