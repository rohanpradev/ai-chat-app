# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

.PHONY: help validate start stop restart status logs clean build dev health local local-stop docker docker-stop kubernetes kubernetes-stop k8s-setup k8s-build k8s-deploy k8s-status k8s-logs k8s-cleanup k8s-stop _show-urls

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
	@make --no-print-directory _show-urls
	@echo "📊 Prometheus:          http://prometheus.localhost"
	@echo "📈 Grafana:             http://grafana.localhost"
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
	@make --no-print-directory _show-urls

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

# Common operations
_show-urls:
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🎯 Main Application:    http://localhost"
	@echo "📡 API Health Check:    http://localhost/health"
	@echo "⚙️  Traefik Dashboard:  http://localhost:8080"
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

k8s-setup: ## Create Kubernetes secrets from .env file
	@echo "Creating Kubernetes secrets from .env file..."
	@node -e "const fs=require('fs');const path='k8s/secrets.yaml';if(!fs.existsSync('.env')){console.error('Error: .env file not found');process.exit(1);}const env=Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split('=',2)));let template=fs.readFileSync('k8s/secrets.yaml.template','utf8');template=template.replace(/\$\{([^}]+)\}/g,(m,k)=>{const[key,def]=k.split(':-');return env[key]||def||'';});fs.writeFileSync(path,template);"
	@echo "Secrets created from .env file"

k8s-build: ## Build and load images for Kubernetes
	@echo "Building images for Kubernetes..."
	@docker build -t chat-app-server:latest --target server-prod .
	@docker build -t chat-app-client:latest --target client-prod .
	@docker build -t chat-app-migrate:latest -f server/Dockerfile.migrate .
	@minikube image load chat-app-server:latest
	@minikube image load chat-app-client:latest
	@minikube image load chat-app-migrate:latest

k8s-deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	@kubectl apply -f k8s/secrets.yaml
	@kubectl apply -f k8s/env-configmap.yaml
	@kubectl apply -f k8s/postgres-data-persistentvolumeclaim.yaml
	@kubectl apply -f k8s/redis-data-persistentvolumeclaim.yaml
	@kubectl apply -f k8s/db-deployment.yaml
	@kubectl apply -f k8s/db-service.yaml
	@kubectl apply -f k8s/redis-deployment.yaml
	@kubectl apply -f k8s/redis-service.yaml
	@echo "Waiting for database to be ready..."
	@kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=database --timeout=300s
	@echo "Running migration job..."
	@kubectl delete job migration --ignore-not-found=true
	@kubectl apply -f k8s/migration-job.yaml
	@kubectl wait --for=condition=complete job/migration --timeout=300s
	@kubectl apply -f k8s/server-deployment.yaml
	@kubectl apply -f k8s/server-service.yaml
	@kubectl apply -f k8s/client-deployment.yaml
	@kubectl apply -f k8s/client-service.yaml
	@echo "Waiting for server to be ready..."
	@kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=server --timeout=300s
	@echo "Waiting for client to be ready..."
	@kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=client --timeout=300s
	@echo "Applying horizontal scaling configuration..."
	@kubectl apply -f k8s/server-hpa.yaml
	@kubectl apply -f k8s/client-hpa.yaml
	@kubectl apply -f k8s/server-pdb.yaml
	@kubectl apply -f k8s/client-pdb.yaml

k8s-status: ## Show Kubernetes deployment status and URLs
	@echo "Kubernetes Status:"
	@echo "=================="
	@kubectl get pods
	@echo ""
	@echo "Application URLs:"
	@echo "================"
	@minikube service client --url
	@minikube service server --url
	@echo ""
	@echo "Run 'minikube service client' to open the application"

k8s-logs: ## Show Kubernetes logs
	@echo "📋 Kubernetes Logs:"
	@kubectl logs -l app.kubernetes.io/name=chat-app --tail=50

k8s-scale-status: ## Show horizontal scaling status
	@echo "📊 Horizontal Pod Autoscaler Status:"
	@echo "===================================="
	@kubectl get hpa
	@echo ""
	@echo "📋 Pod Status:"
	@kubectl get pods -l app.kubernetes.io/name=chat-app
	@echo ""
	@echo "🛡️  Pod Disruption Budgets:"
	@kubectl get pdb

k8s-scale-disable: ## Disable horizontal scaling (set to 1 replica)
	@echo "🔒 Disabling horizontal scaling..."
	@kubectl delete hpa server-hpa client-hpa --ignore-not-found=true
	@kubectl scale deployment server --replicas=1
	@kubectl scale deployment client --replicas=1

k8s-scale-enable: ## Enable horizontal scaling
	@echo "🚀 Enabling horizontal scaling..."
	@kubectl apply -f k8s/server-hpa.yaml
	@kubectl apply -f k8s/client-hpa.yaml

k8s-cleanup: ## Clean up Kubernetes resources
	@echo "🧹 Cleaning up Kubernetes resources..."
	@kubectl delete all --all --ignore-not-found=true
	@kubectl delete pvc --all --ignore-not-found=true
	@kubectl delete secrets --all --ignore-not-found=true
	@kubectl delete configmaps --all --ignore-not-found=true
	@kubectl delete jobs --all --ignore-not-found=true
	@echo "Kubernetes cleanup complete"

k8s-stop: ## Stop Minikube
	@echo "🛑 Stopping Minikube..."
	@minikube stop

