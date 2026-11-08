# ============================================================================
# Quorum OS Backend Dockerfile (Multi-Stage, Context-Agnostic)
# ============================================================================

# --------------------------------------------------------------------------
# Stage 1: Builder
# --------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install system dependencies required for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements from either root or backend/ context
COPY requirements.txt* backend/requirements.txt* ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# --------------------------------------------------------------------------
# Stage 2: Runtime
# --------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

LABEL maintainer="Aaditya Uniyal" \
      org.opencontainers.image.title="Quorum OS Backend" \
      org.opencontainers.image.description="FastAPI backend for Quorum OS"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Install minimal runtime dependencies including Tesseract OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
        libmagic1 \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY --chown=appuser:appuser . .

# Normalize paths if build context was repository root
RUN if [ -d "backend/app" ]; then cp -r backend/* . && rm -rf backend; fi

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000 10000

# Run the FastAPI application with dynamic PORT binding (compatible with Render, Railway, Docker)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
