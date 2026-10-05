# ============================================================================
# Quorum OS Platform - Makefile
# ============================================================================
.PHONY: dev install test lint typecheck build stop clean migrate help

ifeq ($(OS),Windows_NT)
    PYTHON ?= python
    RM_PYCACHE = powershell -Command "Get-ChildItem -Path . -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"
    RM_NEXT = powershell -Command "Remove-Item -Path frontend\.next -Recurse -Force -ErrorAction SilentlyContinue"
    SLEEP = timeout /t 3 /nobreak >nul
else
    PYTHON ?= python3
    RM_PYCACHE = find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    RM_NEXT = rm -rf frontend/.next
    SLEEP = sleep 3
endif

.DEFAULT_GOAL := help

help:
	@echo "============================================"
	@echo "  Quorum OS Platform - Available Commands"
	@echo "============================================"
	@echo "  make install    Install Python & Frontend dependencies"
	@echo "  make dev        Start development infrastructure and apps"
	@echo "  make test       Run test suite across backend"
	@echo "  make lint       Run linters (ruff + eslint)"
	@echo "  make typecheck  Run typecheck (tsc)"
	@echo "  make build      Build Docker images"
	@echo "  make stop       Stop all running Docker services"
	@echo "  make clean      Stop services and remove build artifacts"
	@echo "  make migrate    Run database migrations (Alembic)"
	@echo ""

install:
	@echo "Installing Python dependencies..."
	$(PYTHON) -m pip install -r requirements/base.txt
	@echo "Installing Frontend dependencies..."
	cd frontend && npm install

dev:
	@echo "Starting Quorum OS Platform..."
	docker compose up -d

test:
	@echo "Running backend test suite..."
	cd backend && $(PYTHON) -m pytest tests/

lint:
	@echo "Linting backend (ruff)..."
	$(PYTHON) -m ruff check backend/
	@echo "Linting frontend (eslint)..."
	cd frontend && npm run lint

typecheck:
	@echo "Typechecking frontend..."
	cd frontend && npm run typecheck

build:
	@echo "Building production Docker images..."
	docker compose build

stop:
	@echo "Stopping Quorum OS services..."
	docker compose down

clean:
	@echo "Cleaning runtime and build caches..."
	docker compose down -v --remove-orphans
	$(RM_PYCACHE)
	$(RM_NEXT)
	@echo "Clean completed."

migrate:
	@echo "Running database schema migrations..."
	cd backend && $(PYTHON) -m alembic upgrade head
