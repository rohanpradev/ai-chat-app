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
}

JWT_SECRET="$(read_env JWT_SECRET)"
OPENAI_API_KEY="$(read_env OPENAI_API_KEY)"
LANGFUSE_PUBLIC_KEY="$(read_env LANGFUSE_PUBLIC_KEY)"
LANGFUSE_SECRET_KEY="$(read_env LANGFUSE_SECRET_KEY)"
LANGFUSE_BASEURL="$(read_env LANGFUSE_BASEURL)"
SERPER_API_KEY="$(read_env SERPER_API_KEY)"

yaml_escape() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > "${VALUES_FILE}" <<EOF
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
    CLIENT_URL: http://localhost:30080
    DOMAIN: localhost
    NODE_ENV: development
    VITE_DEV_MODE: "true"
    CORS_ORIGINS: http://localhost:5173,http://localhost:30080

secrets:
  app:
    data:
      POSTGRES_PASSWORD: change-me
      DB_PASSWORD: change-me
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
  service:
    type: NodePort
    nodePort: 30001
  persistence:
    uploads:
      enabled: false
  hpa:
    enabled: false

client:
  replicaCount: 1
  service:
    type: NodePort
    nodePort: 30080
  hpa:
    enabled: false

exposure:
  gateway:
    enabled: false

migration:
  enabled: false
EOF

echo "Generated ${VALUES_FILE} from ${ENV_FILE}."
