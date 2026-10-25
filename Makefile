.PHONY: help install prefetch dev dev-backend dev-frontend test test-backend test-frontend lint docker-up docker-down

help:
	@echo "Wind Forecast Insights - Development Commands"
	@echo "  make install        Install backend and frontend dependencies"
	@echo "  make prefetch       Prefetch Elexon actuals and forecasts for Jan 2026"
	@echo "  make dev            Run both backend and frontend locally in parallel"
	@echo "  make test           Run both backend (pytest) and frontend (vitest) tests"
	@echo "  make lint           Run ruff linting and formatting check"
	@echo "  make docker-up      Build and run full stack via Docker Compose"
	@echo "  make docker-down    Stop Docker Compose containers"

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

prefetch:
	python backend/scripts/prefetch_snapshots.py

dev-backend:
	python -m uvicorn backend.app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test-backend:
	pytest backend/tests -v

test-frontend:
	cd frontend && npm run test

test: test-backend test-frontend

lint:
	ruff check backend/
	cd frontend && npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down
