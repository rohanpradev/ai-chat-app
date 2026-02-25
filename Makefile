# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

.PHONY: help setup validate start stop restart status logs clean build dev health local local-stop docker docker-stop kubernetes kubernetes-stop k8s-setup k8s-traefik k8s-build k8s-deploy k8s-status k8s-logs k8s-cleanup k8s-stop k8s-scale-status k8s-scale-disable k8s-scale-enable _show-urls langfuse-start langfuse-stop langfuse-logs

# Default target
help: ## Show this help message
	@echo "🚀 Chat App - Docker Commands"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Initial setup - Copy .env.example to .env and guide user
	@echo "🚀 Setting up Chat App..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env file from .env.example"; \
		echo ""; \
		echo "📝 Required: Update these 3 values in .env:"; \
		echo "   1. AZURE_API_KEY         - Get from Azure Portal"; \
		echo "   2. AZURE_RESOURCE_NAME   - Your Azure resource name"; \
		echo "   3. JWT_SECRET            - Generate a random 32+ char string"; \
		echo ""; \
		echo "💡 Optional: For Langfuse AI observability:"; \
		echo "   - Start with 'make start' to run self-hosted Langfuse"; \
		echo "   - Login at https://langfuse.localhost"; \
		echo "   - Create project and copy API keys to .env"; \
		echo "   - Restart with 'make restart'"; \
		echo ""; \
		echo "🎯 Next steps:"; \
		echo "   1. Edit .env file with your values"; \
		echo "   2. Run 'make start' to start all services"; \
		echo "   3. Open https://localhost in your browser"; \
	else \
		echo "⚠️  .env file already exists"; \
		echo "💡 Run 'make validate' to check your configuration"; \
	fi

validate: ## Validate .env configuration
	@echo "🔍 Validating configuration..."
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found. Run 'make setup' first."; \
		exit 1; \
	fi
	@echo "Checking required variables..."
	@grep -q "AZURE_API_KEY=.*[^_here]" .env || (echo "❌ AZURE_API_KEY not set" && exit 1)
	@grep -q "AZURE_RESOURCE_NAME=.*[^_here]" .env || (echo "❌ AZURE_RESOURCE_NAME not set" && exit 1)
	@grep -q "JWT_SECRET=.*[^_here]" .env || (echo "❌ JWT_SECRET not set" && exit 1)
	@echo "✅ All required variables are set!"
	@echo "💡 Optional: Check LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY for AI observability"

start: validate ## Start all services and show application URLs
	@echo "🚀 Starting Chat App..."
	@docker compose up -d
	@echo ""
	@echo "⏳ Waiting for services to be ready..."
	@sleep 5
	@echo ""
	@make --no-print-directory _show-urls
	@echo ""
	@echo "✅ Chat App is ready!"
	@echo "🔗 Open https://localhost in your browser to get started"

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
	@make --no-print-directory _show-urls

logs: ## Show logs from all services
	@docker compose logs -f

health: ## Test application health
	@echo "🔍 Testing API health..."
	@curl -f -k https://localhost/health 2>/dev/null && echo "✅ API is healthy" || echo "❌ API is not responding"

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

# Common operations
_show-urls:
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🎯 Main Application:    https://localhost"
	@echo "📡 API Health Check:    https://localhost/health"
	@echo "🔍 Langfuse Dashboard:  https://langfuse.localhost"
	@echo "⚙️  Traefik Dashboard:  http://localhost:8080/dashboard/"
	@echo "🗄️  MinIO Console:       http://localhost:9091"
	@echo "================================"

local: ## Start local development (uses cloud services from .env.local)
	@echo "🛠️  Starting local development environment..."
	@echo "☁️  Using cloud services (database/Redis from .env.local)"
	@echo "🌐 Starting client and server..."
	@echo "📡 Server: http://localhost:$${SERVER_PORT:-3000}"
	@echo "🎯 Client: http://localhost:5173"
	@echo "Press Ctrl+C to stop all services"
	@(cd server && bun run dev) & \
	(cd client && bun run dev) & \
	wait

local-stop: ## Stop local development services
	@echo "🛑 Stopping local development..."
	@pkill -f "bun run dev" || true

# Docker aliases
docker: start ## Alias for Docker Compose start
docker-stop: stop ## Stop Docker Compose services

# Kubernetes Commands
kubernetes: k8s-setup k8s-build k8s-deploy k8s-status ## Complete Kubernetes setup and deployment
kubernetes-stop: k8s-cleanup k8s-stop ## Stop and clean up Kubernetes

k8s-setup: ## Create Helm local values override from template
	@echo "Preparing Helm values..."
	@bun run k8s:prepare

k8s-traefik: ## Install optional Gateway API CRDs (chart auto-skips CRD resources when missing)
	@echo "Installing Gateway API CRDs..."
	@kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml

k8s-build: ## Build and load images for Kubernetes
	@echo "Building images for Kubernetes..."
	@docker build -t chat-app-server:latest --target server-prod .
	@docker build -t chat-app-client:latest --target client-prod .
	@docker build -t chat-app-migrate:latest -f server/Dockerfile.migrate .
	@if command -v minikube >/dev/null 2>&1; then \
		minikube image load chat-app-server:latest; \
		minikube image load chat-app-client:latest; \
		minikube image load chat-app-migrate:latest; \
	else \
		echo "Minikube not found. Skipping image load."; \
	fi

k8s-deploy: ## Deploy to Kubernetes with Helm chart
	@echo "Deploying with Helm..."
	@bash scripts/deploy-k8s.sh

k8s-status: ## Show Kubernetes deployment status and URLs
	@echo "Kubernetes Status:"
	@echo "=================="
	@kubectl get pods,svc,hpa,pdb,job -n default
	@echo ""
	@echo "Helm Releases:"
	@helm list -n default
	@echo ""
	@echo "Application URLs:"
	@echo "================"
	@echo "Client NodePort: http://localhost:30080"
	@echo "Server NodePort: http://localhost:30001"

k8s-logs: ## Show Kubernetes logs
	@echo "📋 Kubernetes Logs:"
	@kubectl logs -l app.kubernetes.io/name=chat-app --tail=50 -n default

k8s-scale-status: ## Show horizontal scaling status
	@echo "📊 Horizontal Pod Autoscaler Status:"
	@echo "===================================="
	@kubectl get hpa -n default
	@echo ""
	@echo "📋 Pod Status:"
	@kubectl get pods -l app.kubernetes.io/name=chat-app -n default
	@echo ""
	@echo "🛡️  Pod Disruption Budgets:"
	@kubectl get pdb -n default

k8s-scale-disable: ## Disable horizontal scaling (set to 1 replica)
	@echo "🔒 Disabling horizontal scaling..."
	@helm upgrade --install chat-app helm/chat-app -n default --create-namespace -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=false --set client.hpa.enabled=false --set server.replicaCount=1 --set client.replicaCount=1

k8s-scale-enable: ## Enable horizontal scaling
	@echo "🚀 Enabling horizontal scaling..."
	@helm upgrade --install chat-app helm/chat-app -n default --create-namespace -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=true --set client.hpa.enabled=true

k8s-cleanup: ## Clean up Kubernetes resources managed by chart
	@echo "🧹 Cleaning up Kubernetes resources..."
	@helm uninstall chat-app -n default --ignore-not-found
	@echo "Kubernetes chart resources cleaned up"

k8s-stop: ## Stop Minikube
	@echo "🛑 Stopping Minikube..."
	@if command -v minikube >/dev/null 2>&1; then \
		minikube stop; \
	else \
		echo "Minikube not found. Nothing to stop."; \
	fi

langfuse-start: ## Start Langfuse observability stack
	@if [ ! -f compose.langfuse.yml ]; then \
		echo "❌ compose.langfuse.yml not found. Add the file or remove Langfuse Make targets."; \
		exit 1; \
	fi
	@echo "🚀 Starting Langfuse standalone..."
	@docker compose -f compose.langfuse.yml up -d
	@echo ""
	@echo "✅ Langfuse started successfully!"
	@echo "🌐 Langfuse:            http://langfuse.localhost:8081"
	@echo "📊 Traefik Dashboard:   http://localhost:8082/dashboard/"
	@echo "👤 Login: admin@localhost / admin"

langfuse-stop: ## Stop Langfuse services
	@if [ ! -f compose.langfuse.yml ]; then \
		echo "❌ compose.langfuse.yml not found. Nothing to stop."; \
		exit 1; \
	fi
	@echo "🛑 Stopping Langfuse..."
	@docker compose -f compose.langfuse.yml down

langfuse-logs: ## Show Langfuse logs
	@if [ ! -f compose.langfuse.yml ]; then \
		echo "❌ compose.langfuse.yml not found. Cannot stream logs."; \
		exit 1; \
	fi
	@echo "📋 Langfuse Logs:"
	@docker compose -f compose.langfuse.yml logs -f
