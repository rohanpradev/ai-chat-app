# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

K8S_NAMESPACE ?= default
K8S_RELEASE ?= chat-app
K8S_SERVER_IMAGE ?= chat-app-server:latest
K8S_CLIENT_IMAGE ?= chat-app-client:latest
K8S_MIGRATE_IMAGE ?= chat-app-migrate:latest
K8S_MIGRATE_JOB ?= $(K8S_RELEASE)-migration
TRAEFIK_NAMESPACE ?= traefik
TRAEFIK_RELEASE ?= traefik
K8S_CLIENT_URL ?= http://localhost:30080
K8S_API_URL ?= http://localhost:30001
K8S_API_HEALTH_URL ?= $(K8S_API_URL)/health
K8S_BUILD_ARGS ?=

.PHONY: help setup validate start stop restart status logs clean build dev health local local-stop docker docker-stop shutdown-all kubernetes kubernetes-stop k8s-setup k8s-traefik k8s-full-stack k8s-build k8s-deploy k8s-migrate k8s-status k8s-logs k8s-cleanup k8s-stop k8s-scale-status k8s-scale-disable k8s-scale-enable k8s-test _show-urls _show-k8s-urls

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
		echo "   1. OPENAI_API_KEY        - Get from platform.openai.com"; \
		echo "   2. JWT_SECRET            - Generate a random 32+ char string"; \
		echo "   3. DB_PASSWORD           - Change from the default for non-local use"; \
		echo ""; \
		echo "💡 Optional: For Langfuse AI observability:"; \
		echo "   - Create a project in Langfuse Cloud"; \
		echo "   - Copy LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to .env"; \
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
	@grep -q "OPENAI_API_KEY=.*[^_here]" .env || (echo "❌ OPENAI_API_KEY not set" && exit 1)
	@grep -q "JWT_SECRET=.*[^_here]" .env || (echo "❌ JWT_SECRET not set" && exit 1)
	@grep -q "DB_PASSWORD=.*[^_here]" .env || (echo "❌ DB_PASSWORD not set" && exit 1)
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

shutdown-all: ## Stop local Kubernetes, remove Docker resources, and stop the local runtime
	@echo "🛑 Shutting down local infrastructure..."
	@if command -v helm >/dev/null 2>&1 && command -v kubectl >/dev/null 2>&1; then \
		helm uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found >/dev/null 2>&1 || true; \
		helm uninstall $(TRAEFIK_RELEASE) -n $(TRAEFIK_NAMESPACE) --ignore-not-found >/dev/null 2>&1 || true; \
		kubectl delete namespace $(TRAEFIK_NAMESPACE) --ignore-not-found=true --wait=false >/dev/null 2>&1 || true; \
	fi
	@if command -v orbctl >/dev/null 2>&1; then \
		orbctl stop k8s >/dev/null 2>&1 || true; \
	fi
	@if command -v minikube >/dev/null 2>&1; then \
		minikube stop >/dev/null 2>&1 || true; \
	fi
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		ids="$$(docker ps -aq)"; \
		if [ -n "$$ids" ]; then docker rm -f $$ids >/dev/null 2>&1 || true; fi; \
		docker system prune -af --volumes >/dev/null 2>&1 || true; \
	fi
	@if command -v orbctl >/dev/null 2>&1; then \
		orbctl stop >/dev/null 2>&1 || true; \
	fi
	@echo "✅ Local Docker and Kubernetes resources have been stopped."

dev: ## Start development environment
	@echo "🛠️  Starting development environment..."
	@bun start

# Common operations
_show-urls:
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🎯 Main Application:    https://localhost"
	@echo "📡 API Health Check:    https://localhost/health"
	@echo "🔍 Langfuse Cloud:      https://cloud.langfuse.com"
	@echo "⚙️  Traefik Dashboard:  http://localhost:8080/dashboard/"
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
kubernetes: k8s-setup k8s-build k8s-deploy k8s-migrate k8s-test k8s-status ## Complete Kubernetes setup and deployment
kubernetes-stop: k8s-cleanup k8s-stop ## Stop and clean up Kubernetes

k8s-setup: ## Create Helm local values override from template
	@echo "Preparing Helm values..."
	@bun run k8s:prepare

k8s-traefik: ## Install Traefik via Helm and expose Gateway routes for local hostname-based access
	@echo "Installing Traefik for Kubernetes Gateway mode..."
	@TRAEFIK_NAMESPACE=$(TRAEFIK_NAMESPACE) TRAEFIK_RELEASE=$(TRAEFIK_RELEASE) bash scripts/deploy-k8s-traefik.sh

k8s-full-stack: ## Install Traefik and deploy the chat app with Docker-like hostname routing
	@helm uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found >/dev/null 2>&1 || true
	@$(MAKE) --no-print-directory k8s-traefik
	@$(MAKE) --no-print-directory kubernetes

k8s-build: ## Build and load images for Kubernetes
	@echo "Building images for Kubernetes..."
	@docker build $(K8S_BUILD_ARGS) -t $(K8S_SERVER_IMAGE) --target server-prod .
	@docker build $(K8S_BUILD_ARGS) -t $(K8S_CLIENT_IMAGE) --target client-prod .
	@docker build $(K8S_BUILD_ARGS) -t $(K8S_MIGRATE_IMAGE) -f server/Dockerfile.migrate .
	@if command -v minikube >/dev/null 2>&1 && [ "$$(kubectl config current-context 2>/dev/null || true)" = "minikube" ]; then \
		minikube image load $(K8S_SERVER_IMAGE); \
		minikube image load $(K8S_CLIENT_IMAGE); \
		minikube image load $(K8S_MIGRATE_IMAGE); \
	else \
		echo "Skipping explicit image load; current cluster is expected to see local images directly."; \
	fi

k8s-deploy: ## Deploy to Kubernetes with Helm chart
	@echo "Deploying with Helm..."
	@NAMESPACE=$(K8S_NAMESPACE) RELEASE_NAME=$(K8S_RELEASE) bash scripts/deploy-k8s.sh

k8s-migrate: ## Run database migrations against the deployed Kubernetes database
	@echo "Running Kubernetes database migration..."
	@NAMESPACE=$(K8S_NAMESPACE) RELEASE_NAME=$(K8S_RELEASE) JOB_NAME=$(K8S_MIGRATE_JOB) MIGRATE_IMAGE=$(K8S_MIGRATE_IMAGE) bash scripts/run-k8s-migration.sh

k8s-test: ## Run a basic Kubernetes smoke test against the deployed app
	@echo "Running Kubernetes smoke test..."
	@kubectl rollout status deployment/$(K8S_RELEASE)-server -n $(K8S_NAMESPACE) --timeout=300s
	@kubectl rollout status deployment/$(K8S_RELEASE)-client -n $(K8S_NAMESPACE) --timeout=300s
	@if curl -fsS $(K8S_API_HEALTH_URL) >/dev/null 2>&1; then \
		echo "✅ API health check passed via NodePort"; \
	else \
		echo "⚠️  NodePort health check did not succeed from localhost"; \
		echo "   Check the URLs from 'make k8s-status' for your current cluster runtime."; \
	fi

k8s-status: ## Show Kubernetes deployment status and URLs
	@echo "Kubernetes Status:"
	@echo "=================="
	@kubectl get deploy,pods,svc,hpa,pdb,pvc -n $(K8S_NAMESPACE) -l app.kubernetes.io/instance=$(K8S_RELEASE)
	@echo ""
	@echo "Routes and Policies:"
	@kubectl get httproute,networkpolicy -n $(K8S_NAMESPACE) 2>/dev/null || true
	@echo ""
	@echo "Helm Releases:"
	@helm list -n $(K8S_NAMESPACE)
	@echo ""
	@make --no-print-directory _show-k8s-urls

k8s-logs: ## Show Kubernetes logs
	@echo "📋 Kubernetes Logs:"
	@kubectl logs -l app.kubernetes.io/instance=$(K8S_RELEASE) --tail=50 -n $(K8S_NAMESPACE) --all-containers=true

k8s-scale-status: ## Show horizontal scaling status
	@echo "📊 Horizontal Pod Autoscaler Status:"
	@echo "===================================="
	@kubectl get hpa -n $(K8S_NAMESPACE)
	@echo ""
	@echo "📋 Pod Status:"
	@kubectl get pods -l app.kubernetes.io/instance=$(K8S_RELEASE) -n $(K8S_NAMESPACE)
	@echo ""
	@echo "🛡️  Pod Disruption Budgets:"
	@kubectl get pdb -n $(K8S_NAMESPACE)

k8s-scale-disable: ## Disable horizontal scaling (set to 1 replica)
	@echo "🔒 Disabling horizontal scaling..."
	@helm upgrade --install $(K8S_RELEASE) helm/chat-app -n $(K8S_NAMESPACE) --create-namespace --wait -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=false --set client.hpa.enabled=false --set server.replicaCount=1 --set client.replicaCount=1

k8s-scale-enable: ## Enable horizontal scaling
	@echo "🚀 Enabling horizontal scaling..."
	@helm upgrade --install $(K8S_RELEASE) helm/chat-app -n $(K8S_NAMESPACE) --create-namespace --wait -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=true --set client.hpa.enabled=true

k8s-cleanup: ## Clean up Kubernetes resources managed by chart
	@echo "🧹 Cleaning up Kubernetes resources..."
	@helm uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found
	@echo "Kubernetes chart resources cleaned up"

k8s-stop: ## Stop Minikube
	@echo "🛑 Stopping Minikube..."
	@if command -v minikube >/dev/null 2>&1; then \
		minikube stop; \
	else \
		echo "Minikube not found. Nothing to stop."; \
	fi

_show-k8s-urls:
	@echo "Application URLs:"
	@echo "================"
	@CONTEXT="$$(kubectl config current-context 2>/dev/null || echo unknown)"; \
	echo "Kubernetes context: $$CONTEXT"; \
	echo "Client NodePort:     $(K8S_CLIENT_URL)"; \
	echo "API NodePort:        $(K8S_API_URL)"; \
	echo "API Health:          $(K8S_API_HEALTH_URL)"; \
	if [ "$$CONTEXT" = "minikube" ] && command -v minikube >/dev/null 2>&1; then \
		echo ""; \
		echo "Resolved Minikube URLs:"; \
		echo "Client Service:      $$(minikube service $(K8S_RELEASE)-client -n $(K8S_NAMESPACE) --url 2>/dev/null | head -n 1)"; \
		echo "Server Service:      $$(minikube service $(K8S_RELEASE)-server -n $(K8S_NAMESPACE) --url 2>/dev/null | head -n 1)"; \
	fi; \
	echo ""; \
	echo "Gateway mode URLs (if Traefik is installed and K8S_GATEWAY_ENABLED=true):"; \
	echo "App Hostname:        https://app.docker.localhost:30001"; \
	echo "Traefik Dashboard:   https://traefik.docker.localhost:30001"
