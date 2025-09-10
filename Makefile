# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

.PHONY: help validate start stop restart status logs clean build dev health local local-stop docker docker-stop kubernetes kubernetes-stop k8s-setup k8s-build k8s-deploy k8s-status k8s-logs k8s-cleanup k8s-stop aks-setup aks-deploy aks-status aks-logs aks-cleanup _show-urls

# Variables
ACR_NAME = aichatacr
RESOURCE_GROUP = ai-chat-rg
CLUSTER_NAME = ai-chat-aks

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
	@echo "📊 Langfuse Dashboard:  http://localhost/langfuse"
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
	@echo "Installing Langfuse via Helm..."
	@helm repo add langfuse https://langfuse.github.io/langfuse-k8s || echo "Repo already added"
	@helm repo update
	@kubectl create namespace langfuse --dry-run=client -o yaml | kubectl apply -f -
	@helm upgrade --install langfuse langfuse/langfuse -n langfuse --wait
	@echo "Deploying application components..."
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
	@kubectl port-forward svc/langfuse-web -n langfuse 3001:3000 &
	@echo "Langfuse: http://localhost:3001 (port-forward)"
	@echo ""
	@echo "Run 'minikube service client' to open the application"
	@echo "Run 'minikube service langfuse-service' to open Langfuse dashboard"

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

# AKS Deployment Commands
aks-setup: ## Setup AKS cluster and ACR (infrastructure)
	@echo "🚀 Setting up AKS infrastructure..."
	@echo "📦 Creating resource group..."
	@az group create --name $(RESOURCE_GROUP) --location eastus || echo "Resource group may already exist"
	@echo "🐳 Creating Azure Container Registry..."
	@az acr create --resource-group $(RESOURCE_GROUP) --name $(ACR_NAME) --sku Standard || echo "ACR may already exist"
	@echo "☸️ Creating AKS cluster..."
	@az aks create \
		--resource-group $(RESOURCE_GROUP) \
		--name $(CLUSTER_NAME) \
		--node-count 2 \
		--enable-addons monitoring \
		--attach-acr $(ACR_NAME) \
		--generate-ssh-keys \
		--node-vm-size Standard_B2s || echo "AKS cluster may already exist"
	@echo "🔑 Getting AKS credentials..."
	@az aks get-credentials --resource-group $(RESOURCE_GROUP) --name $(CLUSTER_NAME)
	@echo "🔒 Installing cert-manager..."
	@kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml || echo "cert-manager may already exist"
	@echo "⏳ Waiting for cert-manager..."
	@kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=300s || echo "cert-manager setup timeout"
	@echo "📋 Applying base Kubernetes manifests..."
	@kubectl apply -f k8s/aks/namespace.yaml || echo "Namespace may already exist"
	@kubectl apply -f k8s/aks/configmap.yaml || echo "ConfigMap may already exist"
	@echo "⚠️  Please update k8s/aks/secrets.yaml with your actual secrets, then run: kubectl apply -f k8s/aks/secrets.yaml"
	@echo "✅ AKS infrastructure setup completed!"

aks-deploy: ## Deploy application to AKS
	@echo "🚀 Deploying application to AKS..."
	@echo "🐳 Building and pushing Docker image..."
	@az acr login --name $(ACR_NAME)
	@docker build -t $(ACR_NAME).azurecr.io/ai-chat-app:latest .
	@docker push $(ACR_NAME).azurecr.io/ai-chat-app:latest
	@echo "📋 Applying application manifests..."
	@kubectl apply -f k8s/aks/deployment.yaml
	@kubectl apply -f k8s/aks/hpa.yaml
	@kubectl apply -f k8s/aks/ingress.yaml
	@echo "⏳ Waiting for deployment rollout..."
	@kubectl rollout status deployment/ai-chat-app -n ai-chat-app --timeout=300s
	@echo "✅ Application deployment completed!"

aks-status: ## Check AKS deployment status
	@echo "📊 AKS Deployment Status:"
	@kubectl get all -n ai-chat-app
	@echo "\n🌐 Ingress Status:"
	@kubectl get ingress -n ai-chat-app

aks-logs: ## Show AKS logs
	@echo "📋 AKS Application Logs:"
	@kubectl logs -l app=ai-chat-app -n ai-chat-app --tail=100

aks-cleanup: ## Clean up AKS resources
	@echo "🧹 Cleaning up AKS resources..."
	@kubectl delete namespace ai-chat-app --ignore-not-found=true
	@az group delete --name $(RESOURCE_GROUP) --yes --no-wait

