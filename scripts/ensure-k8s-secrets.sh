#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${ROOT_DIR}/helm/chat-app/values.local.yaml"
VALUES_TEMPLATE="${ROOT_DIR}/helm/chat-app/values.local.yaml.template"

if [ ! -f "${VALUES_TEMPLATE}" ]; then
  echo "Missing template: ${VALUES_TEMPLATE}" >&2
  exit 1
fi

if [ ! -f "${VALUES_FILE}" ]; then
  cp "${VALUES_TEMPLATE}" "${VALUES_FILE}"
  echo "Created helm/chat-app/values.local.yaml from template. Update placeholder values before production deploys."
fi
