.PHONY: help install clean dev dev-client dev-admin dev-server build build-client build-admin build-server lint format test db-migrate db-seed docker-build docker-up docker-down

help:
	@echo "SyncExc - Development Commands"
	@echo ""
	@echo "  make install        Install all dependencies"
	@echo "  make clean          Remove all build artifacts and node_modules"
	@echo "  make dev            Start all services (server, client, admin)"
	@echo "  make dev-client     Start client dev server"
	@echo "  make dev-admin      Start admin dev server"
	@echo "  make dev-server     Start server dev server"
	@echo "  make build          Build all workspaces"
	@echo "  make lint           Run eslint on all code"
	@echo "  make format         Format all code with prettier"
	@echo "  make test           Run all tests"
	@echo "  make db-migrate     Run database migrations"
	@echo "  make db-seed        Seed database with initial data"
	@echo "  make docker-build   Build docker images"
	@echo "  make docker-up      Start docker compose services"
	@echo "  make docker-down    Stop docker compose services"

install:
	npm install

clean:
	rm -rf node_modules */node_modules package-lock.json dist */dist

dev:
	npm run dev

dev-client:
	npm run dev --workspace=client

dev-admin:
	npm run dev --workspace=admin

dev-server:
	npm run dev --workspace=server

build:
	npm run build

build-client:
	npm run build --workspace=client

build-admin:
	npm run build --workspace=admin

build-server:
	npm run build --workspace=server

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

test:
	npm run test

test-client:
	npm run test --workspace=client

test-server:
	npm run test --workspace=server

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

setup: install
	@cp -n .env.example .env || true
	@echo "Setup complete. Edit .env with your credentials and run 'make dev'"