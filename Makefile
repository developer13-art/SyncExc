# SyncExc — Development Makefile
# Run `make help` to see all available commands.

SHELL := /bin/bash

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@echo "SyncExc — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

.PHONY: install
install: ## Install all dependencies
	npm install

.PHONY: setup
setup: install ## Full first-time setup
	cp -n .env.example .env || true
	docker-compose up -d postgres redis
	sleep 3
	npm run db:migrate
	npm run db:seed

.PHONY: clean
clean: ## Remove all build artifacts and node_modules
	npm run clean

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------

.PHONY: dev
dev: ## Start server + client in dev mode
	npm run dev

.PHONY: dev-server
dev-server: ## Start only the server
	npm run dev:server

.PHONY: dev-client
dev-client: ## Start only the client
	npm run dev:client

.PHONY: dev-admin
dev-admin: ## Start only the admin console
	npm run dev:admin

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------

.PHONY: build
build: ## Build all workspaces
	npm run build

.PHONY: build-server
build-server: ## Build only the server
	npm run build:server

.PHONY: build-client
build-client: ## Build only the client
	npm run build:client

.PHONY: build-admin
build-admin: ## Build only the admin console
	npm run build:admin

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

.PHONY: migrate
migrate: ## Run pending database migrations
	npm run db:migrate

.PHONY: seed
seed: ## Seed the database with default data
	npm run db:seed

.PHONY: db-reset
db-reset: ## Drop, recreate, migrate and seed the database (DEV ONLY)
	npm run db:reset

.PHONY: db-shell
db-shell: ## Open a psql shell to the dev database
	docker-compose exec postgres psql -U postgres -d syncexc

# -----------------------------------------------------------------------------
# Testing
# -----------------------------------------------------------------------------

.PHONY: test
test: ## Run all tests
	npm run test

.PHONY: test-server
test-server: ## Run server tests
	npm run test:server

.PHONY: test-client
test-client: ## Run client tests
	npm run test:client

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	npm run test -- --watch

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	npm run test -- --coverage

# -----------------------------------------------------------------------------
# Lint & Format
# -----------------------------------------------------------------------------

.PHONY: lint
lint: ## Lint all workspaces
	npm run lint

.PHONY: lint-fix
lint-fix: ## Lint and auto-fix
	npm run lint -- --fix

.PHONY: format
format: ## Format all files with Prettier
	npm run format

.PHONY: format-check
format-check: ## Check formatting without writing
	npm run format:check

# -----------------------------------------------------------------------------
# Docker
# -----------------------------------------------------------------------------

.PHONY: docker-up
docker-up: ## Start all services in Docker
	docker-compose up -d

.PHONY: docker-down
docker-down: ## Stop all services
	docker-compose down

.PHONY: docker-restart
docker-restart: ## Restart all services
	docker-compose restart

.PHONY: docker-logs
docker-logs: ## Tail Docker logs
	docker-compose logs -f

.PHONY: docker-logs-server
docker-logs-server: ## Tail server logs only
	docker-compose logs -f server

.PHONY: docker-ps
docker-ps: ## Show running containers
	docker-compose ps

.PHONY: docker-clean
docker-clean: ## Remove all containers, volumes, and images
	docker-compose down -v --rmi local

# -----------------------------------------------------------------------------
# Production
# -----------------------------------------------------------------------------

.PHONY: prod-build
prod-build: ## Build production Docker images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

.PHONY: prod-up
prod-up: ## Start production stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

.PHONY: prod-down
prod-down: ## Stop production stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# -----------------------------------------------------------------------------
# Utility
# -----------------------------------------------------------------------------

.PHONY: generate-secret
generate-secret: ## Generate a random secret (for JWT/SESSION keys)
	@openssl rand -base64 48

.PHONY: generate-encryption-key
generate-encryption-key: ## Generate a 32-byte base64 encryption key
	@openssl rand -base64 32

.PHONY: check-env
check-env: ## Verify .env file exists
	@test -f .env && echo ".env exists" || (echo "Error: .env not found. Copy .env.example first." && exit 1)

.PHONY: health
health: ## Check server health endpoint
	@curl -s http://localhost:4000/api/v1/health | jq . || echo "Server not responding"

.PHONY: logs-clean
logs-clean: ## Remove all log files
	rm -rf logs server/logs