#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/helm/chat-app"
NAMESPACE="default"

bash "${ROOT_DIR}/scripts/ensure-k8s-secrets.sh"

helm upgrade --install chat-app "${CHART_DIR}" \
  -n "${NAMESPACE}" \
  --create-namespace \
  -f "${CHART_DIR}/values.yaml" \
  -f "${CHART_DIR}/values.local.yaml"
