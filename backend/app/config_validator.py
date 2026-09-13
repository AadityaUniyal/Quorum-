import logging

logger = logging.getLogger("app.config.validator")

class ConfigurationError(Exception):
    """Raised when critical configuration is missing or insecure."""
    pass

class ConfigValidator:
    """
    Validates application configuration on startup.
    In 'production' environment, fails fast if insecure settings or placeholders are detected.
    In 'development' or 'test' environments, issues warnings.
    """

    INSECURE_SECRETS = {
        "change-me-generate-a-secure-key",
        "secret",
        "password",
        "123456",
        "dev_insecure_secret_key_change_in_production_min_32_chars_long",
        "development_only_secret_key_32_characters_minimum_entropy_demo",
        "test_environment_secret_key_32_characters_minimum_entropy_pass",
    }

    @classmethod
    def validate(cls, settings) -> None:
        env = getattr(settings, "ENVIRONMENT", "development").lower()
        is_production = env == "production"

        errors: list[str] = []
        warnings: list[str] = []

        # 1. JWT Secret Validation
        jwt_secret = getattr(settings, "JWT_SECRET_KEY", "")
        if not jwt_secret:
            errors.append("JWT_SECRET_KEY is empty or missing.")
        elif len(jwt_secret) < 32:
            msg = f"JWT_SECRET_KEY is too short ({len(jwt_secret)} chars). Minimum 32 chars required."
            if is_production:
                errors.append(msg)
            else:
                warnings.append(msg)
        elif jwt_secret in cls.INSECURE_SECRETS and is_production:
            errors.append("JWT_SECRET_KEY is using a known insecure default in production.")

        # 2. Database URL Validation
        db_url = getattr(settings, "DATABASE_URL", "")
        if not db_url:
            errors.append("DATABASE_URL is not set.")
        elif is_production:
            if "sqlite" in db_url:
                errors.append("SQLite is not supported in production. Configure PostgreSQL.")
            if "user:password@localhost" in db_url or "docintel_user:docintel_pass" in db_url:
                warnings.append("DATABASE_URL appears to contain default development credentials.")

        # 3. Cookie Security in Production
        if is_production:
            if not getattr(settings, "COOKIE_SECURE", False):
                errors.append("COOKIE_SECURE must be True in production to ensure HTTPS-only cookies.")
            if getattr(settings, "DEBUG", False):
                errors.append("DEBUG must be False in production.")

        # 4. CORS Origins in Production
        if is_production:
            origins = settings.get_cors_origins() if hasattr(settings, "get_cors_origins") else []
            if "*" in origins:
                errors.append("Wildcard '*' in CORS_ORIGINS is forbidden in production.")

        # 5. AI Credentials Guidance
        if getattr(settings, "LLM_PREFERRED_PROVIDER", "local") == "gemini":
            has_vertex = bool(getattr(settings, "GOOGLE_CLOUD_PROJECT", None))
            has_api_key = bool(getattr(settings, "GEMINI_API_KEY", None))
            if not has_vertex and not has_api_key:
                errors.append(
                    "LLM_PREFERRED_PROVIDER is set to gemini but neither GOOGLE_CLOUD_PROJECT nor GEMINI_API_KEY is configured."
                )
            if is_production and not has_vertex:
                warnings.append(
                    "Production is using gemini without GOOGLE_CLOUD_PROJECT. Vertex AI with ADC/service account is the recommended production path."
                )

        # Log Warnings
        for w in warnings:
            logger.warning(f"Config Warning: {w}")

        # Fail fast on errors in production
        if errors:
            err_msg = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            if is_production:
                logger.critical(err_msg)
                raise ConfigurationError(err_msg)
            else:
                logger.warning(f"Non-production config notices:\n{err_msg}")
