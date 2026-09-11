#!/usr/bin/env bash
# ==============================================================================
# DOCINTEL AI / GOOGI — ONE-COMMAND DEVELOPMENT STARTUP SCRIPT
# ==============================================================================

set -euo pipefail

echo "================================================================="
echo "   🚀 Starting DocIntel AI / Googi Platform (Development)       "
echo "================================================================="

# 1. Ensure .env file exists
if [ ! -f ".env" ]; then
    echo "[!] .env not found. Copying from .env.development.example..."
    cp .env.development.example .env
fi

# 2. Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "[X] Error: Docker is required to start local infrastructure." >&2
    exit 1
fi

# 3. Start Infrastructure via Docker Compose
echo "[*] Launching database, Redis, RabbitMQ, MinIO, and Ollama..."
docker compose up -d db redis rabbitmq minio ollama

# 4. Wait for healthy infrastructure
echo "[*] Waiting for PostgreSQL, Redis, RabbitMQ and MinIO to report healthy..."
until docker compose ps db | grep -q "healthy"; do
    sleep 2
    printf "."
done
echo ""
echo "[✓] PostgreSQL is ready!"

until docker compose ps redis | grep -q "healthy"; do
    sleep 2
    printf "."
done
echo ""
echo "[✓] Redis is ready!"

until docker compose ps rabbitmq | grep -q "healthy"; do
    sleep 2
    printf "."
done
echo ""
echo "[✓] RabbitMQ is ready!"

# 5. Start Backend, Worker, and Frontend
echo "[*] Starting Application Services..."
docker compose up -d backend worker frontend

echo ""
echo "================================================================="
echo "   ✨ DocIntel AI is running!                                   "
echo "================================================================="
echo "   - Frontend UI:       http://localhost:3000"
echo "   - Backend API Docs:  http://localhost:8000/docs"
echo "   - Health Check:      http://localhost:8000/api/v1/health"
echo "   - MinIO Console:     http://localhost:9001 (minioadmin / minioadmin)"
echo "   - RabbitMQ Mgmt:     http://localhost:15672 (guest / guest)"
echo "   - Ollama API:        http://localhost:11434"
echo "================================================================="
echo "To view live logs: docker compose logs -f"
echo "To stop platform:  docker compose down"
