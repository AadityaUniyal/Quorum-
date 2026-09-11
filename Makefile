# ============================================================================
# DocIntel AI Platform - Makefile
# ============================================================================
.PHONY: dev install test lint typecheck build stop clean migrate migration help

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
	@echo "  DocIntel AI Platform - Available Commands"
	@echo "============================================"
	@echo "  make install    Install Python & Frontend dependencies"
	@echo "  make dev        Start development infrastructure and apps"
	@echo "  make test       Run test suite across monorepo"
	@echo "  make lint       Run linters (ruff + eslint)"
	@echo "  make typecheck  Run typecheck (mypy + tsc)"
	@echo "  make build      Build Docker images"
	@echo "  make stop       Stop all running Docker services"
	@echo "  make clean      Stop services and remove artifacts"
	@echo "  make migrate    Run database migrations (Alembic)"
	@echo ""

install:
	@echo "Installing Python dependencies..."
	$(PYTHON) -m pip install -r requirements/dev.txt
	$(PYTHON) -m pip install -e packages/googi-crawler
	@echo "Installing Frontend dependencies..."
	cd frontend && npm ci

dev:
	@echo "Starting DocIntel AI Platform..."
	docker compose up -d

test:
	@echo "Running tests across monorepo..."
	$(PYTHON) -m pytest

lint:
	@echo "Linting backend (ruff)..."
	$(PYTHON) -m ruff check backend/ packages/ tests/
	@echo "Linting frontend (eslint)..."
	cd frontend && npm run lint

typecheck:
	@echo "Typechecking frontend..."
	cd frontend && npm run typecheck

build:
	@echo "Building Docker images..."
	docker compose build

stop:
	@echo "Stopping Docker services..."
	docker compose down

clean:
	@echo "Cleaning up containers and build artifacts..."
	docker compose down -v
	$(RM_PYCACHE)
	$(RM_NEXT)
	@echo "Clean complete."

migrate:
	@echo "Running database migrations..."
	cd backend && $(PYTHON) -m alembic upgrade head

migration:
ifndef msg
	$(error Usage: make migration msg="migration description")
endif
	cd backend && $(PYTHON) -m alembic revision --autogenerate -m "$(msg)"
