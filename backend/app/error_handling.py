"""
Error tracking initialisation (Roadmap 1.8).
Sentry SDK integration — enabled only when SENTRY_DSN is set in environment.
"""
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def init_sentry():
    """
    Initialise Sentry SDK if SENTRY_DSN is provided.
    No-op if DSN is absent (safe to call always).
    """
    if not settings.SENTRY_DSN:
        logger.debug("SENTRY_DSN not set — Sentry error tracking disabled")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.2 if not settings.DEBUG else 1.0,
            profiles_sample_rate=0.1,
            environment="development" if settings.DEBUG else "production",
            release="googi@1.0.0",
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            # Don't send PII by default
            send_default_pii=False,
        )
        logger.info("Sentry error tracking initialised")
    except ImportError:
        logger.warning("sentry-sdk not installed — skipping Sentry init")
    except Exception as e:
        logger.error(f"Sentry initialisation failed: {e}")
