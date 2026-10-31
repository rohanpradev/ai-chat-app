# Chat App Helm Chart

This chart is the Kubernetes source of truth for the application. It targets Kubernetes 1.35-1.37 with Helm 4.3 and supports either chart-managed PostgreSQL/Redis for self-contained environments or external data services for production.

## Structure

```text
helm/chat-app/
├── Chart.yaml                  chart identity and supported Kubernetes range
├── values.yaml                 production-safe defaults
├── values.schema.json          values contract and type validation
├── values.local.yaml.template  checked-in local development profile
└── templates/
    ├── _helpers.tpl            shared names, labels, images, and host helpers
    ├── validations.yaml        cross-field safety rules
    ├── configmap.yaml          non-secret runtime configuration
    ├── secrets.yaml            opt-in local Secret generation
    ├── deployments.yaml        client/server plus optional DB/Redis workloads
    ├── migration-job.yaml      least-privilege schema migration Job
    ├── services.yaml           internal and optional NodePort Services
    ├── persistentvolumeclaims.yaml retained DB/Redis storage
    ├── hpa.yaml                application autoscaling
    ├── pdb.yaml                disruption budgets
    ├── networkpolicy.yaml      default-deny and explicit traffic policy
    ├── gateway-api.yaml        optional Gateway API and Traefik routes
    └── tests.yaml              Helm smoke-test Pod
```

Keep environment differences in values files, not copied templates. Add a template only when it owns a distinct Kubernetes concern; put reusable naming and rendering logic in `_helpers.tpl`.

## Profiles

Production defaults do not render secret material. Create the Secret named by `secrets.app.existingSecret` outside Helm, preferably through the platform's secret manager. Set `db.enabled=false` and `redis.enabled=false` with the corresponding external hosts for managed data services. Pin production application images with `digest`; a tag remains useful only as human-readable metadata.

For local development, generate the ignored `values.local.yaml` from the checked-in template and `.env`:

```bash
make k8s-setup
make k8s-deploy
```

Do not commit `values.local.yaml`.

## Safety Contract

- HPA-managed Deployments omit `spec.replicas`, preventing two controllers from fighting over scale.
- The server is stateless and uses only bounded ephemeral writable paths.
- PostgreSQL and Redis PVCs default to `helm.sh/resource-policy: keep`.
- The migration Job reads only `DB_URL`, not the complete application Secret.
- Unknown top-level values, invalid types, inverted HPA ranges, incompatible secret modes, and missing external service hosts fail rendering.
- App pods run without service account tokens, drop capabilities, disallow privilege escalation, and use RuntimeDefault seccomp.

Service ports are independent of container listeners. The client listens on 8080, the server uses `config.env.SERVER_PORT`, and the bundled PostgreSQL and Redis listeners remain 5432 and 6379. Proxies and generated connection URLs use the corresponding Service port; NetworkPolicies use the destination pod's listener port.

Generated database and Redis URLs percent-encode credentials, including reserved characters and spaces. An explicit `secrets.app.data.DB_URL` is preserved as supplied. Redis runs as UID/GID 65532 with `fsGroup: 65532` for PVC access, a read-only root filesystem, and no Linux capabilities; the official and hardened image profiles share this configuration.

## Validate

```bash
DEPLOY_CHECK_USE_VALUES_TEMPLATE=1 bun run check:deploy
node scripts/check-helm-runtime-config.mjs
helm lint --strict --kube-version 1.37.1 helm/chat-app
helm template chat-app helm/chat-app --set exposure.gateway.enabled=false
```

CI additionally validates the render with Kubeconform and Kubernetes API-server dry-run. A normal uninstall preserves retained PVCs. Permanent removal is intentionally separate:

```bash
make k8s-cleanup
make k8s-destroy-data CONFIRM=chat-app
```

## Runtime verification and rollout

`bun run check:k8s <local-or-test-context>` installs the built app images with dummy credentials in a disposable namespace, runs migrations and API journeys, verifies the deployed Bun version against the root package-manager pin, replaces the API pod, checks persisted sessions/conversations, and cleans up. See the [Kubernetes runbook](../../k8s/README.md) for supported tools, container checks, and rollout guidance.

The disposable profile deliberately uses reserved characters in database/Redis passwords and client/server Service ports 80/8081 to exercise URL encoding and Service-to-container routing.

The API needs at least 40 seconds of termination grace: 10 seconds for routing propagation, then the application's stream drain and cleanup. The chart rejects shorter values.

When `exposure.gateway.create=true`, set `httpPort` and `httpsPort` to the controller's actual listening ports. The defaults (8000/8443) match the generated Traefik configuration. Disabling TLS now omits the HTTPS listener entirely.

MCP connections are optional. Set `secrets.app.data.MCP_SERVERS` to the JSON connection array, or include `MCP_SERVERS` in the existing app Secret. The default is `[]`. Each connection must specify allowed user IDs and tool names; production also requires `AI_TOOL_APPROVAL_SECRET`. See [MCP configuration](../../docs/mcp.md).
