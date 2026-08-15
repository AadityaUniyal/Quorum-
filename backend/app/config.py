import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App General Config
    APP_NAME: str = "Distributed AI Document Intelligence Platform"
    DEBUG: bool = True

    # Database Config (set via DATABASE_URL env var or .env file)
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/docintel"

    # Security & Auth Config
    JWT_SECRET_KEY: str = ""  # MUST be set via env var — generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 Minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 Days

    # Cookie Config
    COOKIE_SECURE: bool = False  # Set to True in production
    COOKIE_DOMAIN: str | None = None
    COOKIE_SAMESITE: str = "lax"


    # AI Config
    GEMINI_API_KEY: str | None = None
    LLM_MODEL: str = "gemini-1.5-pro"  # Primary LLM model
    LLM_OFFLINE_MOCK_FALLBACK: bool = True  # Enable local regex/extractive fallback when APIs are offline
    
    # LLM Fallback Configuration (Roadmap 1.3)
    # Primary → Secondary → Tertiary (local Ollama)
    LLM_FALLBACK_ENABLED: bool = True
    LLM_SECONDARY_PROVIDER: str | None = None  # e.g., "openai", "anthropic"
    LLM_SECONDARY_API_KEY: str | None = None
    LLM_SECONDARY_MODEL: str | None = None  # e.g., "gpt-4o-mini"
    LLM_TERTIARY_OLLAMA_URL: str = "http://localhost:11434"  # Local Ollama endpoint
    LLM_TERTIARY_MODEL: str = "llama3.1:8b"  # Local fallback model
    
    # LLM Retry Configuration
    LLM_MAX_RETRIES: int = 3
    LLM_RETRY_DELAY_SECONDS: float = 2.0  # Initial delay, uses exponential backoff
    LLM_TIMEOUT_SECONDS: int = 60

    # Broker & Cache Config
    RABBITMQ_HOST: str = "localhost"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASS: str = "guest"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None  # None = no auth (default for dev)
    # Full Redis URL — computed after env resolution via model_validator
    REDIS_URL: str = ""

    @model_validator(mode="after")
    def _compute_redis_url(self) -> "Settings":
        if not self.REDIS_URL:
            password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
            self.REDIS_URL = f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return self
    
    @staticmethod
    def get_redis_url() -> str:
        """Return the Redis connection URL (used by aioredis)."""
        return Settings().REDIS_URL

    # Storage & RAG Directories
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    CHROMA_PERSIST_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")

    # CORS — comma-separated origins, e.g. "http://localhost:3000,https://app.googi.io"
    # Defaults to localhost dev origins.  Set CORS_ORIGINS env var in production.
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    def get_cors_origins(self) -> list[str]:
        """Return CORS_ORIGINS as a parsed list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Observability (Roadmap 1.8)
    SENTRY_DSN: str | None = None           # Set in env to enable Sentry error tracking
    OTLP_ENDPOINT: str = "http://localhost:4317"  # Jaeger / OTel Collector gRPC endpoint

    # Enable reading from .env file
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

# ─── Startup Validation ──────────────────────────────────────────────────────
import logging as _logging
_startup_logger = _logging.getLogger("app.config")

if not settings.JWT_SECRET_KEY or settings.JWT_SECRET_KEY == "":
    _startup_logger.critical("⚠ JWT_SECRET_KEY is not set! Authentication will not work.")
elif len(settings.JWT_SECRET_KEY) < 32:
    _startup_logger.warning("⚠ JWT_SECRET_KEY is shorter than 32 characters. Consider using a stronger key.")

if not settings.GEMINI_API_KEY:
    _startup_logger.warning("ℹ GEMINI_API_KEY is not set. AI features will use offline local fallback.")

if settings.DATABASE_URL == "postgresql://user:password@localhost:5432/docintel":
    _startup_logger.warning("⚠ DATABASE_URL is using the default placeholder. Set it in .env file.")
