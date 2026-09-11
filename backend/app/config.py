import logging
import os
import secrets
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config_validator import ConfigValidator


class Settings(BaseSettings):
    # App General Config
    APP_NAME: str = "DocIntel AI Platform"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "t")

    # Database Config
    DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./test.db"

    # Security & Auth Config
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(64)
    JWT_SECRET_KEYS_ROTATION: str = os.getenv("JWT_SECRET_KEYS_ROTATION", "")  # Comma-separated previous valid keys
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookie Config
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1", "t")
    COOKIE_DOMAIN: str | None = os.getenv("COOKIE_DOMAIN") or None
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")

    # Object Storage Config (local / minio / s3)
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_LOCAL_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "docintel-uploads")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() in ("true", "1", "t")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str | None = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = os.getenv("AWS_SECRET_ACCESS_KEY")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "docintel-uploads")

    # AI Config
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    GOOGLE_APPLICATION_CREDENTIALS: str | None = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_CLOUD_PROJECT: str | None = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
    GOOGLE_CLOUD_LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    GOOGLE_GENAI_USE_ENTERPRISE: bool = os.getenv("GOOGLE_GENAI_USE_ENTERPRISE", "true").lower() in ("true", "1", "t")
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local")  # "local" or "gemini"
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")
    LLM_OFFLINE_MOCK_FALLBACK: bool = os.getenv("LLM_OFFLINE_MOCK_FALLBACK", "false").lower() in ("true", "1", "t")

    # LLM Fallback & Ollama Configuration
    LLM_FALLBACK_ENABLED: bool = True
    LLM_PREFERRED_PROVIDER: str = os.getenv("LLM_PREFERRED_PROVIDER", "local")  # "local" (Ollama) or "gemini"
    LLM_SECONDARY_PROVIDER: str | None = os.getenv("LLM_SECONDARY_PROVIDER")
    LLM_SECONDARY_API_KEY: str | None = os.getenv("LLM_SECONDARY_API_KEY")
    LLM_SECONDARY_MODEL: str | None = os.getenv("LLM_SECONDARY_MODEL")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL") or os.getenv("LLM_TERTIARY_OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL") or os.getenv("LLM_TERTIARY_MODEL", "llama3.1:8b")

    # LLM Retry Configuration
    LLM_MAX_RETRIES: int = 3
    LLM_RETRY_DELAY_SECONDS: float = 2.0
    LLM_TIMEOUT_SECONDS: int = 60

    # Broker & Cache Config
    RABBITMQ_HOST: str = os.getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER: str = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASS: str = os.getenv("RABBITMQ_PASS", "guest")
    RABBITMQ_VHOST: str = os.getenv("RABBITMQ_VHOST", "/")

    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str | None = os.getenv("REDIS_PASSWORD") or None
    REDIS_URL: str = ""

    @model_validator(mode="after")
    def _compute_redis_url(self) -> "Settings":
        if not self.REDIS_URL:
            password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
            self.REDIS_URL = f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return self

    def get_redis_url(self) -> str:
        """Return the Redis connection URL."""
        return self.REDIS_URL

    def get_all_jwt_secrets(self) -> list[str]:
        """Return primary JWT secret followed by any rotation keys."""
        secrets_list = [self.JWT_SECRET_KEY]
        if self.JWT_SECRET_KEYS_ROTATION:
            for k in self.JWT_SECRET_KEYS_ROTATION.split(","):
                k_clean = k.strip()
                if k_clean and k_clean not in secrets_list:
                    secrets_list.append(k_clean)
        return secrets_list

    # Storage & RAG Directories
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    CHROMA_PERSIST_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")

    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:3000")

    def get_cors_origins(self) -> list[str]:
        """Return CORS_ORIGINS as a parsed list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Observability
    SENTRY_DSN: str | None = os.getenv("SENTRY_DSN")
    OTLP_ENDPOINT: str = os.getenv("OTLP_ENDPOINT", "http://localhost:4317")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

# Run validation on startup
ConfigValidator.validate(settings)
