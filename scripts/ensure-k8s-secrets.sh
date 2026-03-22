#!/usr/bin/env bash
set -euo pipefail

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

JWT_SECRET="$(read_env JWT_SECRET)"
OPENAI_API_KEY="$(read_env OPENAI_API_KEY)"
REDIS_AUTH="$(read_env REDIS_AUTH)"
LANGFUSE_PUBLIC_KEY="$(read_env LANGFUSE_PUBLIC_KEY)"
LANGFUSE_SECRET_KEY="$(read_env LANGFUSE_SECRET_KEY)"
LANGFUSE_BASEURL="$(read_env LANGFUSE_BASEURL)"
SERPER_API_KEY="$(read_env SERPER_API_KEY)"
K8S_GATEWAY_ENABLED="$(read_env K8S_GATEWAY_ENABLED)"
K8S_APP_HOSTNAME="$(read_env K8S_APP_HOSTNAME)"
K8S_TRAEFIK_NAMESPACE="$(read_env K8S_TRAEFIK_NAMESPACE)"
K8S_TRAEFIK_GATEWAY_NAME="$(read_env K8S_TRAEFIK_GATEWAY_NAME)"
DHI_USERNAME="$(read_env DHI_USERNAME)"
DHI_PASSWORD="$(read_env DHI_PASSWORD)"
DOCKER_USERNAME="$(read_env DOCKER_USERNAME)"
DOCKER_PASSWORD="$(read_env DOCKER_PASSWORD)"

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

APP_HOSTNAME="${K8S_APP_HOSTNAME:-app.docker.localhost}"
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

cat > "${VALUES_FILE}" <<EOF
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
      POSTGRES_PASSWORD: change-me
      DB_PASSWORD: change-me
      REDIS_AUTH: "$(yaml_escape "${REDIS_AUTH:-redis_password}")"
      JWT_SECRET: "$(yaml_escape "${JWT_SECRET:-}")"
      DB_URL: ""
      OPENAI_API_KEY: "$(yaml_escape "${OPENAI_API_KEY:-}")"
      SERPER_API_KEY: "$(yaml_escape "${SERPER_API_KEY:-}")"
      LANGFUSE_PUBLIC_KEY: "$(yaml_escape "${LANGFUSE_PUBLIC_KEY:-}")"
      LANGFUSE_SECRET_KEY: "$(yaml_escape "${LANGFUSE_SECRET_KEY:-}")"
      LANGFUSE_BASEURL: "$(yaml_escape "${LANGFUSE_BASEURL:-}")"

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

echo "Generated ${VALUES_FILE} from ${ENV_FILE}."
