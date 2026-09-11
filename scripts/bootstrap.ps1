# DocIntel AI / Googi Platform Bootstrap Script (PowerShell)
# Usage: .\scripts\bootstrap.ps1

$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " DocIntel AI Platform Bootstrap & Verification" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Check Python
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "[✓] Python found: $(python --version)" -ForegroundColor Green
} else {
    Write-Error "Python 3.11+ is required but not found in PATH."
}

# 2. Check Node & NPM
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "[✓] NPM found: $(npm --version)" -ForegroundColor Green
} else {
    Write-Error "NPM is required for frontend build."
}

# 3. Setup Backend Environment
Write-Host "`n--> Setting up Backend Virtual Environment..." -ForegroundColor Yellow
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "[✓] Created .venv" -ForegroundColor Green
}

$venvPython = if (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" } else { "python" }

Write-Host "--> Installing backend dependencies..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r backend\requirements.txt

# 4. Setup Frontend Environment
Write-Host "`n--> Setting up Frontend Dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm ci
Set-Location ..

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " DocIntel Platform Bootstrapped Successfully!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
