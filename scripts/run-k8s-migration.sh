#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/helm/chat-app"
NAMESPACE="${NAMESPACE:-default}"
RELEASE_NAME="${RELEASE_NAME:-chat-app}"
JOB_NAME="${JOB_NAME:-${RELEASE_NAME}-migration}"

kubectl delete job "${JOB_NAME}" -n "${NAMESPACE}" --ignore-not-found >/dev/null 2>&1 || true

helm template "${RELEASE_NAME}" "${CHART_DIR}" \
  -n "${NAMESPACE}" \
  -f "${CHART_DIR}/values.yaml" \
  -f "${CHART_DIR}/values.local.yaml" \
  --show-only templates/migration-job.yaml \
  --set migration.enabled=true \
  --set migration.useHook=false |
kubectl apply -n "${NAMESPACE}" -f -

if ! kubectl wait --for=condition=complete "job/${JOB_NAME}" -n "${NAMESPACE}" --timeout=300s; then
  kubectl describe job "${JOB_NAME}" -n "${NAMESPACE}" >&2 || true
  kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=200 >&2 || true
  exit 1
fi

kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=200
