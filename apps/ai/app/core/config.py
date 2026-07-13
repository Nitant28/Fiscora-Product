from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from pathlib import Path

class Settings(BaseSettings):

    APP_NAME: str = "Fiscora AI"
    APP_ENV: str = "development"
    APP_VERSION: str = "1.0.0"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DEVICE: str = "cpu"

    DEFAULT_DPI: int = 300

    UPLOAD_MAX_MB: int = 25

    OCR_CONFIDENCE: float = 0.85
    VISION_CONFIDENCE: float = 0.80
    CLASSIFICATION_CONFIDENCE: float = 0.90

    CACHE_MODELS: bool = True
    MAX_MODELS_IN_MEMORY: int = 3

    ENABLE_GEMINI_FALLBACK: bool = True
    ENABLE_OPENAI_FALLBACK: bool = False

    # Gemini (multimodal semantic extraction). Key lives in the monorepo-root .env.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    LOG_LEVEL: str = "INFO"

    # Load the monorepo-root .env first (shared secrets), then a local override.
    model_config = SettingsConfigDict(
        env_file=(
            str(Path(__file__).resolve().parents[4] / ".env"),
            ".env",
        ),
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings():

    return Settings()


PROJECT_ROOT = Path(__file__).resolve().parents[4]

APPS_DIR = PROJECT_ROOT / "apps"

API_APP_DIR = APPS_DIR / "api"

UPLOAD_DIR = API_APP_DIR / "uploads"