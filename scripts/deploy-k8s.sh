#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/helm/chat-app"
NAMESPACE="${NAMESPACE:-default}"
RELEASE_NAME="${RELEASE_NAME:-chat-app}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-false}"

bash "${ROOT_DIR}/scripts/ensure-k8s-secrets.sh"

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

if [ "${ROLLBACK_ON_FAILURE}" = "true" ]; then
  HELM_ARGS+=(--rollback-on-failure)
fi

helm "${HELM_ARGS[@]}"
