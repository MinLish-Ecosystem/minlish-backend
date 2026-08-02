# ============================================
# Minlish Backend — Docker Makefile
# Convenience commands for Docker operations
# ============================================

# Default target
.PHONY: help
help:
	@echo "Minlish Backend Docker Commands"
	@echo "================================"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build development image"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build production image"
	@echo ""
	@echo "Management:"
	@echo "  make up           - Start all services"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - View logs"
	@echo "  make logs-app     - View app logs"
	@echo "  make logs-mongo   - View MongoDB logs"
	@echo ""
	@echo "Database:"
	@echo "  make mongo        - Connect to MongoDB"
	@echo "  make mongo-seed   - Run database seed"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove containers and volumes"
	@echo "  make rebuild      - Rebuild images without cache"
	@echo "  make shell-app    - Open shell in app container"
	@echo ""
	@echo "Admin:"
	@echo "  make admin        - Start with MongoDB Express"
	@echo ""

# ─────────────────────────────────────────────
# Development Commands
# ─────────────────────────────────────────────

.PHONY: dev
dev: env-copy
	@echo "🚀 Starting Minlish in development mode..."
	docker-compose up -d app
	@echo "✓ App running at http://localhost:3000"
	@echo "✓ API Docs at http://localhost:3000/api-docs"

.PHONY: dev-build
dev-build:
	@echo "🔨 Building development image..."
	docker-compose build --build-target development app

# ─────────────────────────────────────────────
# Production Commands
# ─────────────────────────────────────────────

.PHONY: prod
prod: env-copy
	@echo "🚀 Starting Minlish in production mode..."
	BUILD_TARGET=production docker-compose up -d app
	@echo "✓ Production app running at http://localhost:3000"

.PHONY: prod-build
prod-build:
	@echo "🔨 Building production image..."
	docker-compose build --build-target production app

# ─────────────────────────────────────────────
# Full Stack Commands
# ─────────────────────────────────────────────

.PHONY: up
up: env-copy
	@echo "🚀 Starting full stack (app + mongodb + redis)..."
	docker-compose up -d
	@echo "✓ Services running!"
	@echo "  - App:       http://localhost:3000"
	@echo "  - MongoDB:   localhost:27017"
	@echo "  - Redis:     localhost:6379"

.PHONY: down
down:
	@echo "🛑 Stopping all services..."
	docker-compose down

.PHONY: restart
restart: down up

# ─────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────

.PHONY: logs
logs:
	docker-compose logs -f

.PHONY: logs-app
logs-app:
	docker-compose logs -f app

.PHONY: logs-mongo
logs-mongo:
	docker-compose logs -f mongo

.PHONY: logs-redis
logs-redis:
	docker-compose logs -f redis

# ─────────────────────────────────────────────
# Database Commands
# ─────────────────────────────────────────────

.PHONY: mongo
mongo:
	docker-compose exec mongo mongosh -u admin -p password minlish

.PHONY: mongo-seed
mongo-seed:
	docker-compose exec app npm run seed

# ─────────────────────────────────────────────
# Maintenance
# ─────────────────────────────────────────────

.PHONY: clean
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✓ Cleanup complete!"

.PHONY: rebuild
rebuild:
	@echo "🔨 Rebuilding images without cache..."
	docker-compose build --no-cache

.PHONY: shell-app
shell-app:
	docker-compose exec app sh

# ─────────────────────────────────────────────
# Admin Tools
# ─────────────────────────────────────────────

.PHONY: admin
admin:
	@echo "🚀 Starting with MongoDB Express admin UI..."
	docker-compose --profile admin up -d
	@echo "✓ MongoDB Express at http://localhost:8081"

# ─────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────

.PHONY: env-copy
env-copy:
	@if [ ! -f .env ]; then \
		echo "📝 Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "⚠️  Please edit .env and set your secrets!"; \
	else \
		echo "✓ .env already exists"; \
	fi

.PHONY: status
status:
	docker-compose ps

# Install dependencies if not present
env-create:
	@if [ ! -f .env ]; then cp .env.example .env; fi

.DEFAULT_GOAL := help
