#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

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

APP_HOSTNAME="$(read_env K8S_APP_HOSTNAME)"
TRAEFIK_DASHBOARD_HOSTNAME="$(read_env K8S_TRAEFIK_DASHBOARD_HOSTNAME)"
TRAEFIK_NAMESPACE="$(read_env K8S_TRAEFIK_NAMESPACE)"

APP_HOSTNAME="${APP_HOSTNAME:-app.docker.localhost}"
TRAEFIK_DASHBOARD_HOSTNAME="${TRAEFIK_DASHBOARD_HOSTNAME:-traefik.docker.localhost}"
TRAEFIK_NAMESPACE="${TRAEFIK_NAMESPACE:-traefik}"

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -days 365 \
  -subj "/CN=${APP_HOSTNAME}" \
  -addext "subjectAltName=DNS:${APP_HOSTNAME},DNS:${TRAEFIK_DASHBOARD_HOSTNAME},DNS:localhost" \
  -keyout "${TMP_DIR}/tls.key" \
  -out "${TMP_DIR}/tls.crt" >/dev/null 2>&1

kubectl create namespace "${TRAEFIK_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl create secret tls local-selfsigned-tls \
  -n "${TRAEFIK_NAMESPACE}" \
  --cert="${TMP_DIR}/tls.crt" \
  --key="${TMP_DIR}/tls.key" \
  --dry-run=client \
  -o yaml | kubectl apply -f -

echo "Applied local-selfsigned-tls secret in namespace ${TRAEFIK_NAMESPACE}."
