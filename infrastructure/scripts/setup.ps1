#!/usr/bin/env pwsh
# ============================================================
# SERS — Local Development Setup Script
# Installs all dependencies and starts the system
# Run: ./infrastructure/scripts/setup.ps1
# ============================================================

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  SERS — Smart Emergency Response System" -ForegroundColor Red
Write-Host "  Local Development Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌ Docker not found. Install from https://docker.com" -ForegroundColor Red
    exit 1
} else { Write-Host "  ✅ Docker found" -ForegroundColor Green }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌ Node.js not found. Install from https://nodejs.org (v20+)" -ForegroundColor Red
    exit 1
} else { Write-Host "  ✅ Node.js $(node --version) found" -ForegroundColor Green }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠️  Python not found. ML service will be skipped." -ForegroundColor Yellow
} else { Write-Host "  ✅ Python $(python --version) found" -ForegroundColor Green }

# Create .env
Write-Host ""
Write-Host "[2/6] Setting up environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  ✅ .env created from .env.example" -ForegroundColor Green
    Write-Host "  ⚠️  Please edit .env with your API keys before continuing" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ .env already exists" -ForegroundColor Green
}

# Start Docker services
Write-Host ""
Write-Host "[3/6] Starting Docker services (PostgreSQL + Redis + Nginx)..." -ForegroundColor Yellow
docker-compose up -d postgres redis nginx
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Docker failed to start. Check Docker Desktop is running." -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Docker services started" -ForegroundColor Green

# Wait for PostgreSQL
Write-Host ""
Write-Host "[4/6] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 8
Write-Host "  ✅ PostgreSQL should be ready (schema + seed auto-loaded)" -ForegroundColor Green

# Install Node dependencies
Write-Host ""
Write-Host "[5/6] Installing Node.js dependencies..." -ForegroundColor Yellow
Set-Location services/api
npm install
Set-Location ../..

Set-Location apps/web-admin
npm install
Set-Location ../..

Set-Location apps/mobile
npm install
Set-Location ../..
Write-Host "  ✅ Node dependencies installed" -ForegroundColor Green

# Install Python dependencies
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "[6/6] Installing Python dependencies..." -ForegroundColor Yellow
    Set-Location services/ml
    python -m pip install -r requirements.txt --quiet
    Set-Location ../..
    Write-Host "  ✅ Python dependencies installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  ✅ SERS Setup Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Start the services:" -ForegroundColor Cyan
Write-Host "  API Server:      cd services/api && npm run dev" -ForegroundColor White
Write-Host "  ML Service:      cd services/ml && uvicorn main:app --reload --port 8001" -ForegroundColor White
Write-Host "  Admin Portal:    cd apps/web-admin && npm run dev   (http://localhost:3002)" -ForegroundColor White
Write-Host "  Mobile App:      cd apps/mobile && npx expo start" -ForegroundColor White
Write-Host ""
Write-Host "Test accounts (password: Test@1234):" -ForegroundColor Cyan
Write-Host "  Citizen:        +919876500001" -ForegroundColor White
Write-Host "  Responder:      +919876500003" -ForegroundColor White
Write-Host "  Hospital Staff: +919876500005" -ForegroundColor White
Write-Host "  Admin:          +919876500006" -ForegroundColor White
Write-Host ""
Write-Host "API Health:  http://localhost:3000/api/health" -ForegroundColor Cyan
Write-Host "ML Health:   http://localhost:8001/health" -ForegroundColor Cyan
Write-Host ""
