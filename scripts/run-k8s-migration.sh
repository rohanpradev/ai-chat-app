#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${ROOT_DIR}/scripts/bin:${PATH}"
CHART_DIR="${ROOT_DIR}/helm/chat-app"
NAMESPACE="${NAMESPACE:-default}"
RELEASE_NAME="${RELEASE_NAME:-chat-app}"
JOB_MANIFEST="$(helm template "${RELEASE_NAME}" "${CHART_DIR}" \
  -n "${NAMESPACE}" \
  -f "${CHART_DIR}/values.yaml" \
  -f "${CHART_DIR}/values.local.yaml" \
  --show-only templates/migration-job.yaml \
  --set migration.enabled=true \
  --set migration.useHook=false |
  JOB_NAME="${JOB_NAME:-}" bun --no-env-file -e '
    const job = Bun.YAML.parse(await Bun.stdin.text());
    const name = process.env.JOB_NAME || job?.metadata?.name;
    if (job?.kind !== "Job" || !job.metadata || typeof name !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
      throw new Error("Expected a migration Job with a valid Kubernetes name");
    }
    job.metadata.name = name;
    console.log(JSON.stringify(job));
  ')"
JOB_NAME="$(bun --no-env-file -e 'console.log((await Bun.stdin.json()).metadata.name)' <<< "${JOB_MANIFEST}")"

kubectl delete job "${JOB_NAME}" -n "${NAMESPACE}" --ignore-not-found >/dev/null
kubectl apply -n "${NAMESPACE}" -f - <<< "${JOB_MANIFEST}"

if ! kubectl wait --for=condition=complete "job/${JOB_NAME}" -n "${NAMESPACE}" --timeout=300s; then
  kubectl describe job "${JOB_NAME}" -n "${NAMESPACE}" >&2 || true
  kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=200 >&2 || true
  exit 1
fi

kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=200
