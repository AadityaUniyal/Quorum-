# ==============================================================================
# DOCINTEL AI / GOOGI — ONE-COMMAND DEVELOPMENT STARTUP SCRIPT (POWERSHELL)
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   🚀 Starting DocIntel AI / Googi Platform (Development)       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "[!] .env not found. Creating from .env.development.example..." -ForegroundColor Yellow
    Copy-Item ".env.development.example" ".env"
}

# 2. Check Docker
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[X] Error: Docker is required to start local infrastructure." -ForegroundColor Red
    exit 1
}

# 3. Start Infrastructure
Write-Host "[*] Launching database, Redis, RabbitMQ, MinIO, and Ollama..." -ForegroundColor Green
docker compose up -d db redis rabbitmq minio ollama

# 4. Wait for healthy infrastructure
Write-Host "[*] Waiting for infrastructure containers to become healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 5. Start Backend, Worker, Frontend
Write-Host "[*] Launching Backend, Worker, and Frontend..." -ForegroundColor Green
docker compose up -d backend worker frontend

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   ✨ DocIntel AI is running!                                   " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   - Frontend UI:       http://localhost:3000"
Write-Host "   - Backend API Docs:  http://localhost:8000/docs"
Write-Host "   - Health Check:      http://localhost:8000/api/v1/health"
Write-Host "   - MinIO Console:     http://localhost:9001"
Write-Host "   - RabbitMQ Mgmt:     http://localhost:15672"
Write-Host "   - Ollama API:        http://localhost:11434"
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "To view live logs: docker compose logs -f"
Write-Host "To stop platform:  docker compose down"
