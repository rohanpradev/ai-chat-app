# Chat App - Production Docker Compose
# Modern chat application with Bun, Hono, React, and AI capabilities

K8S_NAMESPACE ?= default
K8S_RELEASE ?= chat-app
K8S_SERVER_IMAGE ?= chat-app-server:latest
K8S_CLIENT_IMAGE ?= chat-app-client:latest
K8S_MIGRATE_IMAGE ?= chat-app-migrate:latest
K8S_MIGRATE_JOB ?= $(K8S_RELEASE)-migration
ENV_FILE ?= .env
TRAEFIK_NAMESPACE ?= $(or $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_TRAEFIK_NAMESPACE=//p' $(ENV_FILE) | tail -n 1 | tr -d '"'),chat-app-traefik)
TRAEFIK_RELEASE ?= $(or $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_TRAEFIK_RELEASE=//p' $(ENV_FILE) | tail -n 1 | tr -d '"'),chat-app-traefik)
DOMAIN ?= $(shell test -f $(ENV_FILE) && sed -n 's/^DOMAIN=//p' $(ENV_FILE) | tail -n 1 | tr -d '"')
API_SLUG ?= $(or $(shell test -f $(ENV_FILE) && sed -n 's/^BASE_API_SLUG=//p' $(ENV_FILE) | tail -n 1 | tr -d '"'),api)
K8S_GATEWAY_ENABLED ?= $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_GATEWAY_ENABLED=//p' $(ENV_FILE) | tail -n 1 | tr -d '"')
K8S_APP_HOSTNAME ?= $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_APP_HOSTNAME=//p' $(ENV_FILE) | tail -n 1 | tr -d '"')
K8S_TRAEFIK_DASHBOARD_HOSTNAME ?= $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_TRAEFIK_DASHBOARD_HOSTNAME=//p' $(ENV_FILE) | tail -n 1 | tr -d '"')
K8S_CLIENT_URL ?= http://localhost:30080
K8S_API_URL ?= http://localhost:30001
K8S_API_HEALTH_URL ?= $(K8S_API_URL)/health
K8S_GATEWAY_HTTPS_PORT ?= $(or $(shell test -f $(ENV_FILE) && sed -n 's/^K8S_TRAEFIK_WEBSECURE_NODE_PORT=//p' $(ENV_FILE) | tail -n 1 | tr -d '"'),31443)
K8S_GATEWAY_URL ?= https://$(K8S_APP_HOSTNAME):$(K8S_GATEWAY_HTTPS_PORT)
K8S_GATEWAY_HEALTH_URL ?= $(K8S_GATEWAY_URL)/$(API_SLUG)/health
K8S_TRAEFIK_DASHBOARD_URL ?= https://$(K8S_TRAEFIK_DASHBOARD_HOSTNAME):$(K8S_GATEWAY_HTTPS_PORT)
DOCKER_TRAEFIK_DASHBOARD_URL ?= https://traefik.$(DOMAIN)
K8S_BUILD_ARGS ?=
K8S_MIN_MINOR ?= 35
K8S_MAX_MINOR ?= 36
RUNTIME_WAIT_SECONDS ?= 60
LOCAL_PID_DIR ?= .local
LOCAL_PID_FILE ?= $(LOCAL_PID_DIR)/dev.pids

RECREATABLE_DIRS := \
	.vite \
	coverage \
	dist \
	node_modules \
	client/.vite \
	client/coverage \
	client/dist \
	client/node_modules \
	server/.vite \
	server/coverage \
	server/dist \
	server/node_modules \
	shared/.vite \
	shared/coverage \
	shared/dist \
	shared/node_modules

RECREATABLE_FILES := \
	client/src/routeTree.gen.ts \
	helm/chat-app/values.local.yaml \
	k8s/traefik-values.generated.yaml

.DEFAULT_GOAL := help
.DELETE_ON_ERROR:

.PHONY: help setup validate ci runtime-start docker-prerequisites start stop restart status logs clean clean-k8s clean-docker clean-local clean-runtime clean-generated docker-destroy-data k8s-destroy-data build dev health local local-stop deploy-check docker docker-stop kubernetes kubernetes-stop k8s-prerequisites k8s-setup k8s-traefik k8s-full-stack k8s-build k8s-deploy k8s-migrate k8s-status k8s-logs k8s-cleanup k8s-stop k8s-scale-status k8s-scale-disable k8s-scale-enable k8s-test _show-urls _show-k8s-urls

# Default target
help: ## Show this help message
	@echo "🚀 Chat App - Docker Commands"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Initial setup - Copy .env.example to .env and guide user
	@echo "🚀 Setting up Chat App..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env file from .env.example"; \
		echo ""; \
		echo "📝 Required: Update these 3 values in .env:"; \
		echo "   1. OPENAI_API_KEY        - Get from platform.openai.com"; \
		echo "   2. BETTER_AUTH_SECRET    - Generate a random 32+ char string"; \
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
	@openai_key="$$(sed -n 's/^OPENAI_API_KEY=//p' .env | tail -n 1 | tr -d '"')"; \
		case "$$openai_key" in ""|your_*|change-me|*_here) echo "❌ OPENAI_API_KEY not set" >&2; exit 1;; esac
	@auth_secret="$$(sed -n 's/^BETTER_AUTH_SECRET=//p' .env | tail -n 1 | tr -d '"')"; \
		if [ -z "$$auth_secret" ]; then auth_secret="$$(sed -n 's/^JWT_SECRET=//p' .env | tail -n 1 | tr -d '"')"; fi; \
		[ "$${#auth_secret}" -ge 32 ] || { echo "❌ BETTER_AUTH_SECRET or JWT_SECRET must contain at least 32 characters" >&2; exit 1; }
	@db_password="$$(sed -n 's/^DB_PASSWORD=//p' .env | tail -n 1 | tr -d '"')"; \
		case "$$db_password" in ""|password|change-me|your_*|*_here) echo "❌ DB_PASSWORD is missing or still uses a placeholder" >&2; exit 1;; esac
	@echo "✅ All required variables are set!"
	@echo "💡 Optional: Check LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY for AI observability"

ci: ## Install the locked dependency graph and run the complete CI gate
	@echo "Installing the locked dependency graph..."
	@bun ci
	@echo "Running security, lint, type, test, build, Docker, Helm, and Kubernetes checks..."
	@bun run check:ci

runtime-start: ## Start the configured local container runtime when supported
	@if docker info >/dev/null 2>&1; then \
		echo "Container runtime is already running."; \
	elif command -v orb >/dev/null 2>&1; then \
		echo "Starting OrbStack..."; \
		orb start; \
		attempts=$$(( $(RUNTIME_WAIT_SECONDS) / 2 )); \
		while ! docker info >/dev/null 2>&1 && [ $$attempts -gt 0 ]; do \
			sleep 2; \
			attempts=$$((attempts - 1)); \
		done; \
		docker info >/dev/null 2>&1 || { echo "Container runtime did not become ready within $(RUNTIME_WAIT_SECONDS)s." >&2; exit 1; }; \
	else \
		echo "Docker is not reachable. Start Docker Desktop, OrbStack, Colima, or another compatible runtime." >&2; \
		exit 1; \
	fi

docker-prerequisites: runtime-start ## Verify Docker Engine and Compose are ready
	@docker version >/dev/null
	@docker compose version >/dev/null
	@echo "Docker Engine and Compose are ready."

start: validate docker-prerequisites ## Build, start, and wait for all Docker Compose services
	@echo "🚀 Starting Chat App..."
	@docker compose up --detach --build --remove-orphans --wait --wait-timeout 300
	@$(MAKE) --no-print-directory health
	@echo ""
	@$(MAKE) --no-print-directory _show-urls
	@echo ""
	@echo "✅ Chat App is ready!"
	@echo "🔗 Open https://localhost in your browser to get started"

stop: ## Stop Docker Compose services
	@echo "🛑 Stopping Chat App..."
	@docker compose down

restart: validate docker-prerequisites ## Rebuild, recreate, and wait for Docker Compose services
	@echo "🔄 Restarting Chat App..."
	@docker compose up --detach --build --force-recreate --remove-orphans --wait --wait-timeout 300
	@$(MAKE) --no-print-directory health
	@$(MAKE) --no-print-directory status

status: ## Show Docker Compose service status and URLs
	@echo "📊 Service Status:"
	@echo "=================="
	@docker compose ps
	@echo ""
	@make --no-print-directory _show-urls

logs: ## Show logs from all Docker Compose services
	@docker compose logs -f

health: ## Test application health
	@echo "🔍 Testing application and API health..."
	@curl --fail --silent --show-error --insecure --retry 10 --retry-all-errors --retry-delay 2 https://localhost/health >/dev/null
	@curl --fail --silent --show-error --insecure --retry 10 --retry-all-errors --retry-delay 2 https://localhost/$(API_SLUG)/health >/dev/null
	@echo "✅ Application and API are healthy"

build: ## Build Docker images
	@echo "🔨 Building Docker images..."
	@docker compose build --pull

clean: clean-k8s clean-docker clean-local clean-generated ## Remove recreatable app resources while preserving data volumes
	@echo "✅ Project cleanup finished. Data volumes and shared cluster infrastructure were preserved."

clean-k8s: ## Clean Kubernetes app resources without stopping the cluster runtime
	@echo "🧹 Cleaning Kubernetes app resources..."
	@if command -v helm >/dev/null 2>&1 && command -v kubectl >/dev/null 2>&1; then \
		helm uninstall $(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found >/dev/null 2>&1 || true; \
		kubectl delete job -l app.kubernetes.io/instance=$(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found=true --wait=true >/dev/null 2>&1 || true; \
	else \
		echo "kubectl or helm not found. Skipping Kubernetes cleanup."; \
	fi
	@echo "✅ Kubernetes app resources cleaned. Persistent data, shared ingress controllers, and namespaces were preserved."

clean-docker: ## Remove Docker Compose resources and local app images, preserving volumes
	@echo "🐳 Cleaning Docker Compose resources..."
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		docker compose down --remove-orphans --rmi local >/dev/null 2>&1 || true; \
		for image in $(K8S_SERVER_IMAGE) $(K8S_CLIENT_IMAGE) $(K8S_MIGRATE_IMAGE); do \
			docker image rm -f "$$image" >/dev/null 2>&1 || true; \
		done; \
	else \
		echo "Docker is not available. Skipping Docker cleanup."; \
	fi
	@echo "✅ Docker resources cleaned. Named data volumes were preserved."

docker-destroy-data: ## Permanently delete this app's Docker Compose volumes (CONFIRM=chat-app)
	@if [ "$(CONFIRM)" != "chat-app" ]; then \
		echo "Refusing to delete Docker data. Re-run with CONFIRM=chat-app." >&2; \
		exit 1; \
	fi
	@command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Docker is not reachable" >&2; exit 1; }
	@docker compose down --volumes --remove-orphans
	@echo "Docker Compose data volumes were permanently deleted."

k8s-destroy-data: ## Permanently delete this Helm release's PVCs (CONFIRM=release-name)
	@if [ "$(CONFIRM)" != "$(K8S_RELEASE)" ]; then \
		echo "Refusing to delete Kubernetes data. Re-run with CONFIRM=$(K8S_RELEASE)." >&2; \
		exit 1; \
	fi
	@command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required" >&2; exit 1; }
	@kubectl delete pvc -l app.kubernetes.io/instance=$(K8S_RELEASE) -n $(K8S_NAMESPACE) --ignore-not-found=true --wait=true
	@echo "Persistent volumes for release $(K8S_RELEASE) were permanently deleted."

clean-local: ## Stop local Bun development processes
	@echo "🛠️  Stopping local development services..."
	@if [ -f "$(LOCAL_PID_FILE)" ]; then \
		while IFS= read -r pid; do \
			case "$$pid" in ''|*[!0-9]*) continue ;; esac; \
			if kill -0 "$$pid" 2>/dev/null; then kill "$$pid" 2>/dev/null || true; fi; \
		done < "$(LOCAL_PID_FILE)"; \
		rm -f "$(LOCAL_PID_FILE)"; \
	else \
		echo "No project-owned local development PID file found."; \
	fi
	@echo "✅ Local development services stopped."

clean-runtime: ## Stop local Kubernetes runtime explicitly
	@echo "🛑 Stopping local Kubernetes runtime..."
	@if command -v orb >/dev/null 2>&1; then \
		orb stop k8s >/dev/null 2>&1 || true; \
	elif command -v orbctl >/dev/null 2>&1; then \
		orbctl stop k8s >/dev/null 2>&1 || true; \
	fi
	@if command -v minikube >/dev/null 2>&1; then \
		minikube stop >/dev/null 2>&1 || true; \
	fi
	@echo "✅ Local Kubernetes runtime stopped."

clean-generated: ## Remove recreatable workspace artifacts without touching .env files
	@echo "🧽 Removing recreatable workspace artifacts..."
	@rm -rf $(RECREATABLE_DIRS)
	@rm -f $(RECREATABLE_FILES)
	@find . -type f -name '*.tsbuildinfo' -delete
	@echo "✅ Removed generated workspace files. .env files were left untouched."

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
	@echo "⚙️  Traefik Dashboard:  $(DOCKER_TRAEFIK_DASHBOARD_URL)"
	@echo "================================"

local: ## Start local development using cloud services from .env.local
	@echo "🛠️  Starting local development environment..."
	@echo "☁️  Using cloud services (database/Redis from .env.local)"
	@echo "🌐 Starting client and server..."
	@echo "📡 Server: http://localhost:$${SERVER_PORT:-3000}"
	@echo "🎯 Client: http://localhost:5173"
	@echo "Press Ctrl+C to stop all services"
	@mkdir -p "$(LOCAL_PID_DIR)"
	@set -eu; \
		server_pid=""; client_pid=""; \
		cleanup() { \
			[ -z "$$server_pid" ] || kill "$$server_pid" 2>/dev/null || true; \
			[ -z "$$client_pid" ] || kill "$$client_pid" 2>/dev/null || true; \
			rm -f "$(LOCAL_PID_FILE)"; \
		}; \
		trap cleanup EXIT HUP INT TERM; \
		(cd server && exec bun run dev) & server_pid=$$!; \
		(cd client && exec bun run dev) & client_pid=$$!; \
		printf '%s\n%s\n' "$$server_pid" "$$client_pid" > "$(LOCAL_PID_FILE)"; \
		wait

local-stop: clean-local ## Stop local development services

deploy-check: ## Validate Docker Compose plus Helm/Kubernetes manifests
	@bun run check:deploy

# Docker aliases
docker: start ## Alias for Docker Compose start
docker-stop: stop ## Stop Docker Compose services

# Kubernetes Commands
kubernetes: k8s-prerequisites ## Complete local Kubernetes setup and deployment
	@$(MAKE) --no-print-directory validate
	@$(MAKE) --no-print-directory ci
	@if [ "$(K8S_GATEWAY_ENABLED)" = "true" ] || [ "$(K8S_GATEWAY_ENABLED)" = "TRUE" ]; then \
		echo "Bootstrapping Traefik for Gateway mode..."; \
		$(MAKE) --no-print-directory k8s-traefik; \
	else \
		echo "Gateway mode disabled; skipping Traefik bootstrap."; \
	fi
	@$(MAKE) --no-print-directory k8s-setup
	@$(MAKE) --no-print-directory k8s-build
	@$(MAKE) --no-print-directory k8s-deploy
	@$(MAKE) --no-print-directory k8s-migrate
	@$(MAKE) --no-print-directory k8s-test
	@$(MAKE) --no-print-directory k8s-status

kubernetes-stop: clean-k8s ## Clean Kubernetes app resources without stopping a shared runtime

k8s-prerequisites: runtime-start ## Verify supported Kubernetes and Helm versions plus cluster access
	@command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required" >&2; exit 1; }
	@command -v helm >/dev/null 2>&1 || { echo "helm is required" >&2; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Docker is not reachable; start Docker Desktop or OrbStack" >&2; exit 1; }
	@kubectl cluster-info >/dev/null 2>&1 || { echo "Kubernetes is not reachable for context '$$(kubectl config current-context 2>/dev/null || echo unknown)'" >&2; exit 1; }
	@helm_major="$$(helm version --template '{{.Version}}' | sed -E 's/^v?([0-9]+).*/\1/')"; \
		[ "$$helm_major" -eq 4 ] || { echo "Helm 4.x is required; found $$(helm version --short)." >&2; exit 1; }
	@kube_minor="$$(kubectl version -o json | sed -nE 's/.*"minor"[[:space:]]*:[[:space:]]*"([0-9]+).*/\1/p' | tail -n 1)"; \
		[ -n "$$kube_minor" ] || { echo "Unable to determine Kubernetes server version." >&2; exit 1; }; \
		[ "$$kube_minor" -ge "$(K8S_MIN_MINOR)" ] && [ "$$kube_minor" -le "$(K8S_MAX_MINOR)" ] || { \
			echo "Kubernetes 1.$(K8S_MIN_MINOR)-1.$(K8S_MAX_MINOR) is required; current server is $$(kubectl version -o json | sed -nE 's/.*"gitVersion"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | tail -n 1)." >&2; \
			exit 1; \
		}
	@echo "Prerequisites ready (context: $$(kubectl config current-context), server: $$(kubectl version -o json | sed -nE 's/.*"gitVersion"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | tail -n 1), Helm: $$(helm version --short))."

k8s-setup: ## Create Helm local values override from template
	@echo "Preparing Helm values..."
	@bun run k8s:prepare

k8s-traefik: ## Install Traefik via Helm and expose Gateway routes for local hostname-based access
	@echo "Installing Traefik for Kubernetes Gateway mode..."
	@K8S_APP_NAMESPACE=$(K8S_NAMESPACE) TRAEFIK_NAMESPACE=$(TRAEFIK_NAMESPACE) TRAEFIK_RELEASE=$(TRAEFIK_RELEASE) bash scripts/deploy-k8s-traefik.sh

k8s-full-stack: ## Alias for the one-command full local Kubernetes bootstrap
	@$(MAKE) --no-print-directory kubernetes

k8s-build: ## Build and load images for Kubernetes
	@echo "Building images for Kubernetes..."
	@docker build --pull $(K8S_BUILD_ARGS) -t $(K8S_SERVER_IMAGE) --target server-prod .
	@docker build --pull $(K8S_BUILD_ARGS) -t $(K8S_CLIENT_IMAGE) --target client-prod .
	@docker build --pull $(K8S_BUILD_ARGS) -t $(K8S_MIGRATE_IMAGE) -f server/Dockerfile.migrate .
	@context="$$(kubectl config current-context 2>/dev/null || true)"; \
	if command -v minikube >/dev/null 2>&1 && [ "$$context" = "minikube" ]; then \
		minikube image load $(K8S_SERVER_IMAGE); \
		minikube image load $(K8S_CLIENT_IMAGE); \
		minikube image load $(K8S_MIGRATE_IMAGE); \
	elif command -v kind >/dev/null 2>&1 && [ "$${context#kind-}" != "$$context" ]; then \
		cluster_name="$${context#kind-}"; \
		kind load docker-image --name "$$cluster_name" $(K8S_SERVER_IMAGE) $(K8S_CLIENT_IMAGE) $(K8S_MIGRATE_IMAGE); \
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
	@helm test $(K8S_RELEASE) -n $(K8S_NAMESPACE) --logs --timeout 2m
	@if [ "$(K8S_GATEWAY_ENABLED)" = "true" ] || [ "$(K8S_GATEWAY_ENABLED)" = "TRUE" ]; then \
		if curl -kfSs $(K8S_GATEWAY_HEALTH_URL) >/dev/null 2>&1; then \
			echo "✅ API health check passed via Gateway"; \
		else \
			echo "❌ Gateway health check did not succeed from localhost" >&2; \
			echo "   Check the URLs from 'make k8s-status' for your current cluster runtime."; \
			exit 1; \
		fi; \
	elif curl -fsS $(K8S_API_HEALTH_URL) >/dev/null 2>&1; then \
		echo "✅ API health check passed via NodePort"; \
	else \
		echo "❌ NodePort health check did not succeed from localhost" >&2; \
		echo "   Check the URLs from 'make k8s-status' for your current cluster runtime."; \
		exit 1; \
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

k8s-scale-disable: ## Disable horizontal scaling and set replicas to 1
	@echo "🔒 Disabling horizontal scaling..."
	@helm upgrade --install $(K8S_RELEASE) helm/chat-app -n $(K8S_NAMESPACE) --create-namespace --wait -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=false --set client.hpa.enabled=false --set server.replicaCount=1 --set client.replicaCount=1

k8s-scale-enable: ## Enable horizontal scaling
	@echo "🚀 Enabling horizontal scaling..."
	@helm upgrade --install $(K8S_RELEASE) helm/chat-app -n $(K8S_NAMESPACE) --create-namespace --wait -f helm/chat-app/values.yaml -f helm/chat-app/values.local.yaml --set server.hpa.enabled=true --set client.hpa.enabled=true

k8s-cleanup: clean-k8s ## Clean up Kubernetes resources managed by chart

k8s-stop: clean-runtime ## Explicitly stop the local Kubernetes runtime (affects every local workload)

_show-k8s-urls:
	@echo "Application URLs:"
	@echo "================"
	@CONTEXT="$$(kubectl config current-context 2>/dev/null || echo unknown)"; \
	echo "Kubernetes context: $$CONTEXT"; \
	if [ "$(K8S_GATEWAY_ENABLED)" = "true" ] || [ "$(K8S_GATEWAY_ENABLED)" = "TRUE" ]; then \
		echo "Primary App URL:     $(K8S_GATEWAY_URL)"; \
		echo "Primary API Health:  $(K8S_GATEWAY_HEALTH_URL)"; \
		echo "Traefik Dashboard:   $(K8S_TRAEFIK_DASHBOARD_URL)"; \
	else \
		echo "Client NodePort:     $(K8S_CLIENT_URL)"; \
		echo "API NodePort:        $(K8S_API_URL)"; \
		echo "API Health:          $(K8S_API_HEALTH_URL)"; \
		echo "Gateway App URL:     $(K8S_GATEWAY_URL)"; \
		echo "Traefik Dashboard:   $(K8S_TRAEFIK_DASHBOARD_URL)"; \
	fi; \
	if [ "$$CONTEXT" = "minikube" ] && command -v minikube >/dev/null 2>&1; then \
		echo ""; \
		echo "Resolved Minikube URLs:"; \
		echo "Client Service:      $$(minikube service $(K8S_RELEASE)-client -n $(K8S_NAMESPACE) --url 2>/dev/null | head -n 1)"; \
		echo "Server Service:      $$(minikube service $(K8S_RELEASE)-server -n $(K8S_NAMESPACE) --url 2>/dev/null | head -n 1)"; \
	fi
