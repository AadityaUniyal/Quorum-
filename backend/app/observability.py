"""
OpenTelemetry tracing initialisation (Roadmap 1.8).
Exports spans to configured OTLP endpoint (Jaeger / Honeycomb / etc.).
Falls back gracefully when the collector is unreachable.
"""
import logging

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.config import settings

logger = logging.getLogger(__name__)


def init_tracing(app):
    """
    Initialise OpenTelemetry distributed tracing for the FastAPI app.

    - Exports to OTLP (settings.OTLP_ENDPOINT) when reachable.
    - Silently skips setup if the exporter import fails or endpoint is blank.
    """
    resource = Resource(attributes={
        "service.name": "googi-backend",
        "service.version": "1.0.0",
        "deployment.environment": "development" if settings.DEBUG else "production",
    })

    provider = TracerProvider(resource=resource)

    # Attempt OTLP export to Jaeger / OTel Collector
    if settings.OTLP_ENDPOINT:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            otlp_exporter = OTLPSpanExporter(endpoint=settings.OTLP_ENDPOINT, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            logger.info(f"OpenTelemetry OTLP exporter → {settings.OTLP_ENDPOINT}")
        except Exception as e:
            logger.warning(f"OTLP exporter not available (collector may be down): {e}")

    # In DEBUG mode also dump spans to console
    if settings.DEBUG:
        try:
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        except Exception:
            pass

    trace.set_tracer_provider(provider)

    # Instrument FastAPI — auto-adds spans for every request
    try:
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        logger.info("FastAPI auto-instrumentation enabled")
    except Exception as e:
        logger.warning(f"FastAPI instrumentation failed: {e}")
