#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${ROOT_DIR}/k8s/traefik-values.generated.yaml"
ENV_FILE="${ROOT_DIR}/.env"
TRAEFIK_NAMESPACE="${TRAEFIK_NAMESPACE:-traefik}"
TRAEFIK_RELEASE="${TRAEFIK_RELEASE:-traefik}"

read_env() {
  local key="$1"
  local line value

  if [ ! -f "${ENV_FILE}" ]; then
    return 1
  fi

  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  value="${line#*=}"
  value="$(printf '%s' "${value}" | sed -E 's/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//')"

  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "${value}"
}

TRAEFIK_CHART_REF="${TRAEFIK_CHART_REF:-$(read_env TRAEFIK_CHART_REF || true)}"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-$(read_env TRAEFIK_CHART_VERSION || true)}"
TRAEFIK_CHART_REF="${TRAEFIK_CHART_REF:-oci://ghcr.io/traefik/helm/traefik}"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-39.0.8}"

bash "${ROOT_DIR}/scripts/ensure-k8s-traefik-values.sh"
bash "${ROOT_DIR}/scripts/ensure-k8s-local-tls.sh"
NAMESPACE="${TRAEFIK_NAMESPACE}" SECRET_NAME="dhi-registry" bash "${ROOT_DIR}/scripts/ensure-k8s-registry-secret.sh"

if [[ "${TRAEFIK_CHART_REF}" == traefik/* ]]; then
  helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
  helm repo update >/dev/null
fi

CRD_ARGS=(
  show
  crds
  "${TRAEFIK_CHART_REF}"
)

if [ -n "${TRAEFIK_CHART_VERSION}" ]; then
  CRD_ARGS+=(--version "${TRAEFIK_CHART_VERSION}")
fi

helm "${CRD_ARGS[@]}" | kubectl apply --server-side --force-conflicts -f -

HELM_ARGS=(
  upgrade
  --install
  "${TRAEFIK_RELEASE}"
  "${TRAEFIK_CHART_REF}"
  -n "${TRAEFIK_NAMESPACE}"
  --create-namespace
  --skip-crds
  --wait
  --timeout 10m
  -f "${VALUES_FILE}"
)

if [ -n "${TRAEFIK_CHART_VERSION}" ]; then
  HELM_ARGS+=(--version "${TRAEFIK_CHART_VERSION}")
fi

helm "${HELM_ARGS[@]}"
