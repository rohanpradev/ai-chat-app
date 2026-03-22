#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${ROOT_DIR}/k8s/traefik-values.generated.yaml"
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

APP_HOSTNAME="$(read_env K8S_APP_HOSTNAME)"
TRAEFIK_DASHBOARD_HOSTNAME="$(read_env K8S_TRAEFIK_DASHBOARD_HOSTNAME)"
TRAEFIK_NAMESPACE="$(read_env K8S_TRAEFIK_NAMESPACE)"
TRAEFIK_GATEWAY_NAME="$(read_env K8S_TRAEFIK_GATEWAY_NAME)"
TRAEFIK_LOG_LEVEL="$(read_env TRAEFIK_LOG_LEVEL)"
TRAEFIK_DASHBOARD_USER="$(read_env TRAEFIK_DASHBOARD_USER)"
TRAEFIK_DASHBOARD_PASSWORD="$(read_env TRAEFIK_DASHBOARD_PASSWORD)"
TRAEFIK_IMAGE_REGISTRY="$(read_env TRAEFIK_IMAGE_REGISTRY)"
TRAEFIK_IMAGE_REPOSITORY="$(read_env TRAEFIK_IMAGE_REPOSITORY)"
TRAEFIK_IMAGE_TAG="$(read_env TRAEFIK_IMAGE_TAG)"
TRAEFIK_IMAGE_DIGEST="$(read_env TRAEFIK_IMAGE_DIGEST)"
DHI_USERNAME="$(read_env DHI_USERNAME)"
DHI_PASSWORD="$(read_env DHI_PASSWORD)"
DOCKER_USERNAME="$(read_env DOCKER_USERNAME)"
DOCKER_PASSWORD="$(read_env DOCKER_PASSWORD)"

APP_HOSTNAME="${APP_HOSTNAME:-app.docker.localhost}"
TRAEFIK_DASHBOARD_HOSTNAME="${TRAEFIK_DASHBOARD_HOSTNAME:-traefik.docker.localhost}"
TRAEFIK_NAMESPACE="${TRAEFIK_NAMESPACE:-traefik}"
TRAEFIK_GATEWAY_NAME="${TRAEFIK_GATEWAY_NAME:-traefik-gateway}"
TRAEFIK_LOG_LEVEL="${TRAEFIK_LOG_LEVEL:-INFO}"
TRAEFIK_DASHBOARD_USER="${TRAEFIK_DASHBOARD_USER:-admin}"
TRAEFIK_DASHBOARD_PASSWORD="${TRAEFIK_DASHBOARD_PASSWORD:-change-me}"
TRAEFIK_IMAGE_REGISTRY="${TRAEFIK_IMAGE_REGISTRY:-dhi.io}"
TRAEFIK_IMAGE_REPOSITORY="${TRAEFIK_IMAGE_REPOSITORY:-traefik}"
TRAEFIK_IMAGE_TAG="${TRAEFIK_IMAGE_TAG:-3.6.11-debian13}"

if [ -n "${TRAEFIK_IMAGE_DIGEST:-}" ]; then
  IMAGE_TAG="${TRAEFIK_IMAGE_TAG}@${TRAEFIK_IMAGE_DIGEST}"
else
  IMAGE_TAG="${TRAEFIK_IMAGE_TAG}"
fi

if [ -z "${DHI_USERNAME:-}" ]; then
  DHI_USERNAME="${DOCKER_USERNAME:-}"
fi

if [ -z "${DHI_PASSWORD:-}" ]; then
  DHI_PASSWORD="${DOCKER_PASSWORD:-}"
fi

if [ -n "${DHI_USERNAME:-}" ] && [ -n "${DHI_PASSWORD:-}" ]; then
  TRAEFIK_DEPLOYMENT_BLOCK=$(cat <<'EOF'
deployment:
  imagePullSecrets:
    - name: dhi-registry
EOF
)
else
  TRAEFIK_DEPLOYMENT_BLOCK=""
fi

IMAGE_BLOCK=$(cat <<EOF
image:
  registry: ${TRAEFIK_IMAGE_REGISTRY}
  repository: ${TRAEFIK_IMAGE_REPOSITORY}
  tag: ${IMAGE_TAG}
  pullPolicy: IfNotPresent
EOF
)

cat > "${VALUES_FILE}" <<EOF
${TRAEFIK_DEPLOYMENT_BLOCK}
${IMAGE_BLOCK}

service:
  type: NodePort

ports:
  web:
    port: 8000
    exposedPort: 80
    nodePort: 30000
  websecure:
    port: 8443
    exposedPort: 443
    nodePort: 30001
    tls:
      enabled: true

additionalArguments:
  - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
  - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
  - "--entrypoints.web.http.redirections.entryPoint.permanent=true"
  - "--ping=true"

api:
  dashboard: true
  insecure: false

ingressRoute:
  dashboard:
    enabled: true
    matchRule: Host(\`${TRAEFIK_DASHBOARD_HOSTNAME}\`)
    entryPoints:
      - websecure
    middlewares:
      - name: dashboard-auth

extraObjects:
  - apiVersion: v1
    kind: Secret
    metadata:
      name: dashboard-auth-secret
      namespace: ${TRAEFIK_NAMESPACE}
    type: kubernetes.io/basic-auth
    stringData:
      username: "${TRAEFIK_DASHBOARD_USER}"
      password: "${TRAEFIK_DASHBOARD_PASSWORD}"
  - apiVersion: traefik.io/v1alpha1
    kind: Middleware
    metadata:
      name: dashboard-auth
      namespace: ${TRAEFIK_NAMESPACE}
    spec:
      basicAuth:
        secret: dashboard-auth-secret

ingressClass:
  enabled: false

providers:
  kubernetesIngress:
    enabled: false
  kubernetesGateway:
    enabled: true

gateway:
  enabled: true
  name: ${TRAEFIK_GATEWAY_NAME}
  namespace: ${TRAEFIK_NAMESPACE}
  listeners:
    web:
      port: 8000
      protocol: HTTP
      namespacePolicy:
        from: All
    websecure:
      port: 8443
      protocol: HTTPS
      namespacePolicy:
        from: All
      mode: Terminate
      certificateRefs:
        - kind: Secret
          name: local-selfsigned-tls
          group: ""
          namespace: ${TRAEFIK_NAMESPACE}

logs:
  general:
    level: ${TRAEFIK_LOG_LEVEL}
  access:
    enabled: true

metrics:
  prometheus:
    enabled: true
    addRoutersLabels: true
    addServicesLabels: true
    addEntryPointsLabels: true

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

readinessProbe:
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 2

livenessProbe:
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 2
EOF

echo "Generated ${VALUES_FILE} from ${ENV_FILE}."
