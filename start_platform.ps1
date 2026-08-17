# Windows PowerShell Startup Script for Distributed AI Document Intelligence Platform

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Starting Distributed AI Document Intelligence Platform" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Start Docker Services (if Docker is available)
Write-Host "[1/4] Checking Docker availability..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    $dockerCheck = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
} catch {}

if ($dockerRunning) {
    Write-Host "Docker daemon is running. Launching ALL services via Docker Compose..." -ForegroundColor Green
    docker-compose up --build
    exit
} else {
    Write-Host "Docker daemon is not running. Operating in Standalone In-Process mode." -ForegroundColor Yellow
}

# 2. Database Migrations (for SQLite local development)
Write-Host "[2/4] Running database migrations..." -ForegroundColor Yellow
try {
    cd backend
    python -m alembic upgrade head
    cd ..
    Write-Host "Database migrations completed successfully." -ForegroundColor Green
} catch {
    Write-Host "Failed to run database migrations. Please ensure Python dependencies are installed." -ForegroundColor Red
    cd ..
}

# 3. Start FastAPI Backend & Background Worker
Write-Host "[3/4] Starting FastAPI Backend and background worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting FastAPI Backend...' -ForegroundColor Cyan; cd backend; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Background Processing Worker...' -ForegroundColor Cyan; cd backend; python -m app.worker"

# 4. Start Next.js Frontend
Write-Host "[4/4] Starting Next.js Dev Server on http://localhost:3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Next.js Frontend...' -ForegroundColor Cyan; cd frontend; npm run dev"

Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  Platform Launch Complete!" -ForegroundColor Green
Write-Host "  - Next.js Web Portal: http://localhost:3000" -ForegroundColor Green
Write-Host "  - FastAPI Interactive Documentation: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

