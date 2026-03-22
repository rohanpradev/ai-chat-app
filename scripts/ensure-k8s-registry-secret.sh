#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
NAMESPACE="${NAMESPACE:-default}"
SECRET_NAME="${SECRET_NAME:-dhi-registry}"
REGISTRY_SERVER="${REGISTRY_SERVER:-dhi.io}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line value

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

USERNAME="${DHI_USERNAME:-$(read_env DHI_USERNAME)}"
PASSWORD="${DHI_PASSWORD:-$(read_env DHI_PASSWORD)}"

if [ -z "${USERNAME:-}" ]; then
  USERNAME="${DOCKER_USERNAME:-$(read_env DOCKER_USERNAME)}"
fi

if [ -z "${PASSWORD:-}" ]; then
  PASSWORD="${DOCKER_PASSWORD:-$(read_env DOCKER_PASSWORD)}"
fi

if [ -z "${USERNAME:-}" ] || [ -z "${PASSWORD:-}" ]; then
  echo "Skipping registry secret for ${REGISTRY_SERVER}; credentials are not configured."
  exit 0
fi

kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}" >/dev/null

kubectl create secret docker-registry "${SECRET_NAME}" \
  --namespace "${NAMESPACE}" \
  --docker-server "${REGISTRY_SERVER}" \
  --docker-username "${USERNAME}" \
  --docker-password "${PASSWORD}" \
  --dry-run=client \
  -o yaml | kubectl apply -f -

echo "Ensured image pull secret ${SECRET_NAME} in namespace ${NAMESPACE}."
