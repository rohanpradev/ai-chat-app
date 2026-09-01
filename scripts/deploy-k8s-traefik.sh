#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${ROOT_DIR}/k8s/traefik-values.generated.yaml"
ENV_FILE="${ROOT_DIR}/.env"
TRAEFIK_NAMESPACE="${TRAEFIK_NAMESPACE:-traefik}"
TRAEFIK_RELEASE="${TRAEFIK_RELEASE:-traefik}"
HELM_HISTORY_MAX="${HELM_HISTORY_MAX:-10}"

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

is_stable_semver() {
  [[ "${1#v}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

semver_is_newer() {
  local left="${1#v}" right="${2#v}"
  local left_major left_minor left_patch right_major right_minor right_patch

  IFS=. read -r left_major left_minor left_patch <<< "${left}"
  IFS=. read -r right_major right_minor right_patch <<< "${right}"

  ((
    10#${left_major} > 10#${right_major} ||
      (10#${left_major} == 10#${right_major} && 10#${left_minor} > 10#${right_minor}) ||
      (10#${left_major} == 10#${right_major} && 10#${left_minor} == 10#${right_minor} && 10#${left_patch} > 10#${right_patch})
  ))
}

semver_skips_minor() {
  local current="${1#v}" target="${2#v}"
  local current_major current_minor current_patch target_major target_minor target_patch

  IFS=. read -r current_major current_minor current_patch <<< "${current}"
  IFS=. read -r target_major target_minor target_patch <<< "${target}"

  ((10#${target_major} != 10#${current_major} || 10#${target_minor} - 10#${current_minor} > 1))
}

TRAEFIK_CHART_REF="${TRAEFIK_CHART_REF:-$(read_env TRAEFIK_CHART_REF || true)}"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-$(read_env TRAEFIK_CHART_VERSION || true)}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-$(read_env GATEWAY_API_VERSION || true)}"
TRAEFIK_CHART_REF="${TRAEFIK_CHART_REF:-oci://ghcr.io/traefik/helm/traefik}"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-41.4.0}"
# Traefik 3.7 currently documents conformance with Gateway API 1.6.1.
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.6.1}"

bash "${ROOT_DIR}/scripts/ensure-k8s-traefik-values.sh"
bash "${ROOT_DIR}/scripts/ensure-k8s-local-tls.sh"
NAMESPACE="${TRAEFIK_NAMESPACE}" SECRET_NAME="dhi-registry" bash "${ROOT_DIR}/scripts/ensure-k8s-registry-secret.sh"

if [[ "${TRAEFIK_CHART_REF}" == traefik/* ]]; then
  helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
  helm repo update >/dev/null
fi

GATEWAY_API_CRDS_URL="https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"
GATEWAY_API_CRDS_FILE="$(mktemp)"
trap 'rm -f "${GATEWAY_API_CRDS_FILE}"' EXIT

if ! is_stable_semver "${GATEWAY_API_VERSION}"; then
  echo "GATEWAY_API_VERSION must be a stable vMAJOR.MINOR.PATCH release, got: ${GATEWAY_API_VERSION}" >&2
  exit 1
fi

GATEWAY_API_CRD="gateways.gateway.networking.k8s.io"
if kubectl get crd "${GATEWAY_API_CRD}" >/dev/null 2>&1; then
  CURRENT_GATEWAY_API_VERSION="$(kubectl get crd "${GATEWAY_API_CRD}" -o jsonpath='{.metadata.annotations.gateway\.networking\.k8s\.io/bundle-version}')"
  CURRENT_GATEWAY_API_CHANNEL="$(kubectl get crd "${GATEWAY_API_CRD}" -o jsonpath='{.metadata.annotations.gateway\.networking\.k8s\.io/channel}')"

  if ! is_stable_semver "${CURRENT_GATEWAY_API_VERSION}"; then
    echo "Refusing to overwrite Gateway API CRDs with an unknown bundle version: ${CURRENT_GATEWAY_API_VERSION:-missing}" >&2
    exit 1
  fi

  if [ "${CURRENT_GATEWAY_API_CHANNEL}" != "standard" ]; then
    echo "Refusing to replace Gateway API channel '${CURRENT_GATEWAY_API_CHANNEL:-unknown}' with the standard channel." >&2
    exit 1
  fi

  if semver_is_newer "${CURRENT_GATEWAY_API_VERSION}" "${GATEWAY_API_VERSION}"; then
    echo "Refusing to downgrade Gateway API from ${CURRENT_GATEWAY_API_VERSION} to ${GATEWAY_API_VERSION}." >&2
    exit 1
  fi

  if semver_is_newer "${GATEWAY_API_VERSION}" "${CURRENT_GATEWAY_API_VERSION}" && semver_skips_minor "${CURRENT_GATEWAY_API_VERSION}" "${GATEWAY_API_VERSION}"; then
    echo "Refusing to skip Gateway API minor releases (${CURRENT_GATEWAY_API_VERSION} -> ${GATEWAY_API_VERSION}); upgrade one minor at a time." >&2
    exit 1
  fi
fi

curl -fsSL "${GATEWAY_API_CRDS_URL}" -o "${GATEWAY_API_CRDS_FILE}"
kubectl apply --server-side -f "${GATEWAY_API_CRDS_FILE}"

CRD_ARGS=(
  show
  crds
  "${TRAEFIK_CHART_REF}"
)

if [ -n "${TRAEFIK_CHART_VERSION}" ]; then
  CRD_ARGS+=(--version "${TRAEFIK_CHART_VERSION}")
fi

helm "${CRD_ARGS[@]}" | sed -n '/^---/,$p' | kubectl apply --server-side --force-conflicts -f -

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
  --history-max "${HELM_HISTORY_MAX}"
  --rollback-on-failure
  --hide-notes
  -f "${VALUES_FILE}"
)

if [ -n "${TRAEFIK_CHART_VERSION}" ]; then
  HELM_ARGS+=(--version "${TRAEFIK_CHART_VERSION}")
fi

helm "${HELM_ARGS[@]}"
