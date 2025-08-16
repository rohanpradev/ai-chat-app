# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

.PHONY: help validate start stop restart status logs clean build dev health k8s-validate k8s-deploy k8s-status k8s-logs k8s-cleanup

# Default target
help: ## Show this help message
	@echo "🚀 Chat App - Docker Commands"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start all services and show application URLs
	@echo "🚀 Starting Chat App..."
	@docker compose up -d
	@echo ""
	@echo "⏳ Waiting for services to be ready..."
	@sleep 3
	@echo ""
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🎯 Main Application:    http://localhost"
	@echo "📡 API Health Check:    http://localhost/health"
	@echo "⚙️  Traefik Dashboard:  http://localhost:8080"
	@echo "📊 Prometheus:          http://prometheus.localhost"
	@echo "📈 Grafana:             http://grafana.localhost"
	@echo "================================"
	@echo ""
	@echo "✅ Chat App is ready!"
	@echo "🔗 Open http://localhost in your browser to get started"

stop: ## Stop all services
	@echo "🛑 Stopping Chat App..."
	@docker compose down

restart: ## Restart all services
	@echo "🔄 Restarting Chat App..."
	@docker compose down
	@docker compose up -d
	@make --no-print-directory status

status: ## Show service status and URLs
	@echo "📊 Service Status:"
	@echo "=================="
	@docker compose ps
	@echo ""
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🎯 Main Application:    http://localhost"
	@echo "📡 API Health Check:    http://localhost/health"
	@echo "⚙️  Traefik Dashboard:  http://localhost:8080"
	@echo "================================"

logs: ## Show logs from all services
	@docker compose logs -f

health: ## Test application health
	@echo "🔍 Testing API health..."
	@curl -f http://localhost/health 2>/dev/null && echo "✅ API is healthy" || echo "❌ API is not responding"

build: ## Build all images
	@echo "🔨 Building Docker images..."
	@docker compose build

clean: ## Stop services and remove containers, networks, and volumes
	@echo "🧹 Cleaning up..."
	@docker compose down -v --remove-orphans
	@docker system prune -f

dev: ## Start development environment
	@echo "🛠️  Starting development environment..."
	@bun start

