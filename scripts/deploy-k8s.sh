#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/helm/chat-app"
NAMESPACE="${NAMESPACE:-default}"
RELEASE_NAME="${RELEASE_NAME:-chat-app}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-false}"

bash "${ROOT_DIR}/scripts/ensure-k8s-secrets.sh"
NAMESPACE="${NAMESPACE}" SECRET_NAME="dhi-registry" bash "${ROOT_DIR}/scripts/ensure-k8s-registry-secret.sh"

HELM_ARGS=(
  upgrade
  --install
  "${RELEASE_NAME}"
  "${CHART_DIR}"
  -n "${NAMESPACE}"
  --create-namespace
  --wait
  --wait-for-jobs
  --timeout 10m
  -f "${CHART_DIR}/values.yaml"
  -f "${CHART_DIR}/values.local.yaml"
)

# Local Kubernetes uses stable image tags such as :latest with imagePullPolicy=Never.
# Bump pod-template annotations on each deploy so rebuilt local images actually roll out.
BUILD_STAMP="$(date -u +%Y%m%d%H%M%S)"
HELM_ARGS+=(
  --set-string "client.podAnnotations.local-build-timestamp=${BUILD_STAMP}"
  --set-string "server.podAnnotations.local-build-timestamp=${BUILD_STAMP}"
)

if [ "${ROLLBACK_ON_FAILURE}" = "true" ]; then
  HELM_ARGS+=(--rollback-on-failure)
fi

helm "${HELM_ARGS[@]}"
