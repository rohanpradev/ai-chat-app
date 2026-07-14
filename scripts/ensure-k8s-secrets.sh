#!/usr/bin/env bash
set -euo pipefail

# Generated values contain credentials. New temporary and output files must not
# be readable by other local users, regardless of the caller's umask.
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${ROOT_DIR}/helm/chat-app/values.local.yaml"
ENV_FILE="${ROOT_DIR}/.env"

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
  return 0
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

to_lower() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]'
}

is_local_hostname() {
  case "$(to_lower "${1:-}")" in
    ""|localhost|localhost:*|127.0.0.1|127.0.0.1:*|::1|\[::1\]|*.localhost|*.localhost:*|*.docker.localhost|*.docker.localhost:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_production_node_env() {
  case "$(to_lower "${1:-}")" in
    prod|production|stage|staging|preview)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_validation_mode() {
  local requested_mode node_env domain app_hostname

  requested_mode="$(to_lower "${1:-auto}")"
  node_env="${2:-}"
  domain="${3:-localhost}"
  app_hostname="${4:-app.docker.localhost}"

  case "${requested_mode}" in
    production|strict)
      printf '%s' production
      ;;
    local)
      if is_production_node_env "${node_env}" || ! is_local_hostname "${domain}" || ! is_local_hostname "${app_hostname}"; then
        echo "K8S_SECRET_VALIDATION_MODE=local is only allowed with a development/test environment and local hostnames." >&2
        return 1
      fi
      printf '%s' local
      ;;
    auto|"")
      if ! is_local_hostname "${domain}" || ! is_local_hostname "${app_hostname}"; then
        printf '%s' production
      elif is_production_node_env "${node_env}" && ! is_truthy "${CI:-false}"; then
        printf '%s' production
      else
        # CI uses non-deployable localhost fixtures to render and lint manifests.
        printf '%s' local
      fi
      ;;
    *)
      echo "K8S_SECRET_VALIDATION_MODE must be one of: auto, local, production." >&2
      return 1
      ;;
  esac
}

is_required_placeholder() {
  local name normalized
  name="$1"
  normalized="$(to_lower "${2:-}")"

  case "${name}:${normalized}" in
    OPENAI_API_KEY:your_openai_api_key_here|OPENAI_API_KEY:replace-me|OPENAI_API_KEY:change-me|\
    BETTER_AUTH_SECRET:your_secure_better_auth_secret_here_min_32_characters|\
    BETTER_AUTH_SECRET:your_better_auth_secret_32_chars_minimum_here|BETTER_AUTH_SECRET:replace-me|BETTER_AUTH_SECRET:change-me|\
    DB_PASSWORD:your_db_password_here|DB_PASSWORD:replace-me|DB_PASSWORD:change-me|DB_PASSWORD:changeme)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

require_configured_secret() {
  local name value
  name="$1"
  value="${2:-}"

  if [ -z "${value}" ]; then
    echo "${name} is required in ${ENV_FILE}." >&2
    return 1
  fi

  if is_required_placeholder "${name}" "${value}"; then
    echo "${name} still contains an example placeholder in ${ENV_FILE}." >&2
    return 1
  fi
}

is_weak_password() {
  case "$(to_lower "${1:-}")" in
    admin|admin123|change-me|changeme|password|postgres|redis_password|test|test-password)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

BETTER_AUTH_SECRET="$(read_env BETTER_AUTH_SECRET)"
if [ -z "${BETTER_AUTH_SECRET}" ]; then
  BETTER_AUTH_SECRET="$(read_env JWT_SECRET)"
fi
DB_PASSWORD="$(read_env DB_PASSWORD)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
GITHUB_CLIENT_ID="$(read_env GITHUB_CLIENT_ID)"
GITHUB_CLIENT_SECRET="$(read_env GITHUB_CLIENT_SECRET)"
AI_TOOL_APPROVAL_SECRET="$(read_env AI_TOOL_APPROVAL_SECRET)"
OPENAI_API_KEY="$(read_env OPENAI_API_KEY)"
OPENAI_MODEL_OVERRIDES="$(read_env OPENAI_MODEL_OVERRIDES)"
REDIS_AUTH="$(read_env REDIS_AUTH)"
LANGFUSE_PUBLIC_KEY="$(read_env LANGFUSE_PUBLIC_KEY)"
LANGFUSE_SECRET_KEY="$(read_env LANGFUSE_SECRET_KEY)"
LANGFUSE_BASE_URL="$(read_env LANGFUSE_BASE_URL)"
if [ -z "${LANGFUSE_BASE_URL}" ]; then
  LANGFUSE_BASE_URL="$(read_env LANGFUSE_BASEURL)"
fi
SERPER_API_KEY="$(read_env SERPER_API_KEY)"
SENTRY_DSN="$(read_env SENTRY_DSN)"
K8S_GATEWAY_ENABLED="$(read_env K8S_GATEWAY_ENABLED)"
K8S_APP_HOSTNAME="$(read_env K8S_APP_HOSTNAME)"
K8S_TRAEFIK_NAMESPACE="$(read_env K8S_TRAEFIK_NAMESPACE)"
K8S_TRAEFIK_GATEWAY_NAME="$(read_env K8S_TRAEFIK_GATEWAY_NAME)"
DHI_USERNAME="$(read_env DHI_USERNAME)"
DHI_PASSWORD="$(read_env DHI_PASSWORD)"
DOCKER_USERNAME="$(read_env DOCKER_USERNAME)"
DOCKER_PASSWORD="$(read_env DOCKER_PASSWORD)"
SOURCE_NODE_ENV="$(read_env NODE_ENV)"
SOURCE_DOMAIN="$(read_env DOMAIN)"
SECRET_VALIDATION_MODE="${K8S_SECRET_VALIDATION_MODE:-$(read_env K8S_SECRET_VALIDATION_MODE)}"

if [ -n "${DB_PASSWORD}" ] && [ -n "${POSTGRES_PASSWORD}" ] && [ "${DB_PASSWORD}" != "${POSTGRES_PASSWORD}" ]; then
  echo "DB_PASSWORD and POSTGRES_PASSWORD must match when the bundled PostgreSQL service is used." >&2
  exit 1
fi

DATABASE_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
DB_PASSWORD="${DATABASE_PASSWORD}"
POSTGRES_PASSWORD="${DATABASE_PASSWORD}"
REDIS_AUTH="${REDIS_AUTH:-redis_password}"

APP_HOSTNAME="${K8S_APP_HOSTNAME:-app.docker.localhost}"
SOURCE_DOMAIN="${SOURCE_DOMAIN:-localhost}"
VALIDATION_MODE="$(resolve_validation_mode "${SECRET_VALIDATION_MODE:-auto}" "${SOURCE_NODE_ENV:-development}" "${SOURCE_DOMAIN}" "${APP_HOSTNAME}")"

require_configured_secret OPENAI_API_KEY "${OPENAI_API_KEY}"
require_configured_secret BETTER_AUTH_SECRET "${BETTER_AUTH_SECRET}"
require_configured_secret DB_PASSWORD "${DB_PASSWORD}"

if [ "${#BETTER_AUTH_SECRET}" -lt 32 ]; then
  echo "BETTER_AUTH_SECRET must contain at least 32 characters." >&2
  exit 1
fi

if [ "${VALIDATION_MODE}" = production ]; then
  if [ "${#DB_PASSWORD}" -lt 16 ] || is_weak_password "${DB_PASSWORD}"; then
    echo "DB_PASSWORD must be a non-placeholder value of at least 16 characters for production-like generation." >&2
    exit 1
  fi

  if [ "${#REDIS_AUTH}" -lt 16 ] || is_weak_password "${REDIS_AUTH}"; then
    echo "REDIS_AUTH must be a non-placeholder value of at least 16 characters for production-like generation." >&2
    exit 1
  fi
elif is_weak_password "${DB_PASSWORD}" || is_weak_password "${REDIS_AUTH}"; then
  echo "Warning: local-only database or Redis credentials are in use; production-like generation would reject them." >&2
fi

if [ -z "${DHI_USERNAME:-}" ]; then
  DHI_USERNAME="${DOCKER_USERNAME:-}"
fi

if [ -z "${DHI_PASSWORD:-}" ]; then
  DHI_PASSWORD="${DOCKER_PASSWORD:-}"
fi

yaml_escape() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
  return 0
}

TRAEFIK_NAMESPACE="${K8S_TRAEFIK_NAMESPACE:-traefik}"
TRAEFIK_GATEWAY_NAME="${K8S_TRAEFIK_GATEWAY_NAME:-traefik-gateway}"

if is_truthy "${K8S_GATEWAY_ENABLED:-false}"; then
  CLIENT_URL_VALUE="https://${APP_HOSTNAME}:30001"
  DOMAIN_VALUE="${APP_HOSTNAME}"
  CORS_ORIGINS_VALUE="https://${APP_HOSTNAME}:30001,http://localhost:5173"
  SERVER_SERVICE_BLOCK=$(cat <<EOF
  service:
    type: ClusterIP
EOF
)
  CLIENT_SERVICE_BLOCK=$(cat <<EOF
  service:
    type: ClusterIP
EOF
)
  GATEWAY_BLOCK=$(cat <<EOF
  gateway:
    enabled: true
    namespace: ${TRAEFIK_NAMESPACE}
    name: ${TRAEFIK_GATEWAY_NAME}
    hostnames:
      - ${APP_HOSTNAME}
    tls:
      enabled: true
      secretName: local-selfsigned-tls
    createMiddlewares: true
    cors:
      allowOrigins:
        - https://${APP_HOSTNAME}:30001
    rateLimit:
      average: 100
      burst: 200
      period: 1m
EOF
)
else
  CLIENT_URL_VALUE="http://localhost:30080"
  DOMAIN_VALUE="localhost"
  CORS_ORIGINS_VALUE="http://localhost:5173,http://localhost:30080"
  SERVER_SERVICE_BLOCK=$(cat <<'EOF'
  service:
    type: NodePort
    nodePort: 30001
EOF
)
  CLIENT_SERVICE_BLOCK=$(cat <<'EOF'
  service:
    type: NodePort
    nodePort: 30080
EOF
)
  GATEWAY_BLOCK=$(cat <<'EOF'
  gateway:
    enabled: false
EOF
)
fi

if [ -n "${DHI_USERNAME:-}" ] && [ -n "${DHI_PASSWORD:-}" ]; then
  IMAGE_PULL_SECRETS_BLOCK=$(cat <<'EOF'
imagePullSecrets:
  - name: dhi-registry
EOF
)
else
  IMAGE_PULL_SECRETS_BLOCK=""
fi

VALUES_TMP="$(mktemp "${VALUES_FILE}.tmp.XXXXXX")"
cleanup() {
  rm -f "${VALUES_TMP}"
}
trap cleanup EXIT

cat > "${VALUES_TMP}" <<EOF
# Generated by scripts/ensure-k8s-secrets.sh from .env.
# This file contains local secrets and is intentionally ignored by git.
${IMAGE_PULL_SECRETS_BLOCK}
images:
  client:
    tag: latest
    pullPolicy: Never
  server:
    tag: latest
    pullPolicy: Never
  migrate:
    tag: latest
    pullPolicy: Never
  db:
    registry: ""
    repository: pgvector/pgvector
    tag: pg18
    pullPolicy: IfNotPresent
  redis:
    registry: ""
    repository: redis
    tag: "8"
    pullPolicy: IfNotPresent

config:
  env:
    CLIENT_URL: ${CLIENT_URL_VALUE}
    DOMAIN: ${DOMAIN_VALUE}
    NODE_ENV: production
    VITE_DEV_MODE: "false"
    CORS_ORIGINS: ${CORS_ORIGINS_VALUE}

secrets:
  app:
    data:
      POSTGRES_PASSWORD: "$(yaml_escape "${POSTGRES_PASSWORD}")"
      DB_PASSWORD: "$(yaml_escape "${DB_PASSWORD}")"
      REDIS_AUTH: "$(yaml_escape "${REDIS_AUTH}")"
      BETTER_AUTH_SECRET: "$(yaml_escape "${BETTER_AUTH_SECRET:-}")"
      DB_URL: ""
      GITHUB_CLIENT_ID: "$(yaml_escape "${GITHUB_CLIENT_ID:-}")"
      GITHUB_CLIENT_SECRET: "$(yaml_escape "${GITHUB_CLIENT_SECRET:-}")"
      AI_TOOL_APPROVAL_SECRET: "$(yaml_escape "${AI_TOOL_APPROVAL_SECRET:-}")"
      OPENAI_API_KEY: "$(yaml_escape "${OPENAI_API_KEY:-}")"
      OPENAI_MODEL_OVERRIDES: "$(yaml_escape "${OPENAI_MODEL_OVERRIDES:-}")"
      SERPER_API_KEY: "$(yaml_escape "${SERPER_API_KEY:-}")"
      LANGFUSE_PUBLIC_KEY: "$(yaml_escape "${LANGFUSE_PUBLIC_KEY:-}")"
      LANGFUSE_SECRET_KEY: "$(yaml_escape "${LANGFUSE_SECRET_KEY:-}")"
      LANGFUSE_BASEURL: "$(yaml_escape "${LANGFUSE_BASE_URL:-}")"
      SENTRY_DSN: "$(yaml_escape "${SENTRY_DSN:-}")"

networkPolicy:
  enabled: false

server:
  replicaCount: 1
${SERVER_SERVICE_BLOCK}
  persistence:
    uploads:
      enabled: false
  hpa:
    enabled: false

client:
  replicaCount: 1
${CLIENT_SERVICE_BLOCK}
  hpa:
    enabled: false

exposure:
${GATEWAY_BLOCK}

migration:
  enabled: false
EOF

chmod 600 "${VALUES_TMP}"
mv -f "${VALUES_TMP}" "${VALUES_FILE}"
trap - EXIT
chmod 600 "${VALUES_FILE}"

echo "Generated ${VALUES_FILE} from ${ENV_FILE} with mode 0600 (${VALIDATION_MODE} validation)."
