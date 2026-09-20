# September 2026 modernization

## Scope and acceptance

Refresh the app against current upstream releases while preserving sign-in, saved conversations, streamed answers, tool approvals, rich content, and deployment behavior. Starting review point: `05adcc8`.

The implementation covers three connected slices:

1. Dependency and runtime upgrades, verified by types, tests, production builds, audit, and container startup.
2. Better Auth schema compatibility and device-session controls, verified through real database-backed API requests and browser failure/retry flows.
3. Deployment upgrades, verified by rendered manifests and disposable Kubernetes deployments that run migrations, exercise authentication and CRUD, and restart the API.

## Version decisions (checked September 20)

| Area | Selected version |
| --- | --- |
| React / React DOM | 19.3.0 |
| AI SDK / React bindings / OpenAI provider | 7.0.105 / 4.0.108 / 4.0.66 |
| Better Auth / Drizzle adapter | 1.7.5 |
| Drizzle ORM / Kit | 1.0.0-rc.4 |
| Vitest / coverage | 5.0.1 |
| Vite / TypeScript / Bun | 8.3.0 / 7.0.2 / 1.4.2 |
| Nginx | 1.31.6-alpine3.24 |
| Traefik / Helm chart | 3.7.13 / 41.6.0 |
| Helm / kind / CI Kubernetes | 4.3.0 / 0.33.0 / 1.37.0 |
| PostgreSQL / pgvector | 18 / 0.8.6 |
| Redis | 8.10.1 |

The workspace manifests and lockfile contain the complete package upgrade set. The existing 72-hour release-age gate remains enabled. Compatible security overrides were refreshed, including provider-utils 5.0.43 and brace-expansion 5.0.12.

Drizzle stays on the official `rc` dist-tag, pinned reproducibly to rc.4. The separate `rc5` development tag is not the published `rc` channel. Do not downgrade Drizzle to the older npm `latest` stable line when refreshing other packages. See [Drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases).

Compatibility holds:

- Keep KaTeX on 0.16.47 because the current Streamdown math and rehype-katex packages require 0.16. Matching the CSS and renderer avoids broken equation layout. Do not independently upgrade the CSS to 0.18.
- Keep Mermaid on the compatible 11.x line required by the Streamdown plugin.
- Redis 8.10.2 was announced, but `redis:8.10.2-trixie` returned “no such manifest” during verification. Retain the available 8.10.1 image; do not publish a nonexistent image reference. See [Redis release](https://github.com/redis/redis/releases/tag/8.10.2).
- Gateway API remains 1.6.1, the version documented by [Traefik's Gateway provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/kubernetes/kubernetes-gateway/).

## Application changes

The chat home uses the existing AI Elements composer, a clearer primary input, compact starters, and responsive spacing. Message actions remain available on touch screens. Tool cards use the AI SDK's stable `isToolOutputErrorUIPart` guard and preserve supplied tool titles. Scroll and download controls have accessible names.

The official AI Elements registry sources for conversation, message, tool, reasoning, and prompt-input were rechecked. Local components retain equivalent upstream behavior plus the app's lazy rich-content loading and file-acceptance improvements. Replacing these wholesale would remove useful behavior. See [AI Elements](https://elements.ai-sdk.dev/docs/usage).

The auth profile now lists active sessions, distinguishes the current device, and supports revoking an individual session or every other session. Loading and revocation failures allow retry. Tokens are not rendered, persisted, or logged. Cookie session caching stays explicitly disabled so revocation is checked against the database immediately. Better Auth's new instrumentation switch disables auth spans in the AI telemetry pipeline. Existing encrypted OAuth tokens, password hashing, origin restrictions, and optional GitHub sign-in remain configured.

The Hono OpenAPI upgrade correctly returns `415 Unsupported Media Type` for a body sent without its declared content type; valid JSON requests remain unchanged. The regression test now asserts that documented behavior. See [Hono release](https://github.com/honojs/middleware/releases/tag/%40hono%2Fzod-openapi%401.6.3).

React and Vitest release references: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [Vitest releases](https://github.com/vitest-dev/vitest/releases). The current suites exercise the upgraded runtime; no speculative React APIs were added merely to increase API usage.

## Auth migration and rollout

Better Auth 1.7.3+ identifies accounts by provider/account and no longer writes the issuer introduced in 1.7.0–1.7.2. The generated `20260920021214_better_auth_provider_identity` migration makes the legacy issuer nullable and replaces its unique index with provider/account uniqueness. Existing issuer values and user/account rows are retained. See the [Better Auth upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide).

Before production rollout:

1. Back up the database and check for duplicate identities:

   ```sql
   SELECT provider_id, account_id, count(*)
   FROM account GROUP BY provider_id, account_id HAVING count(*) > 1;
   ```

2. Resolve any duplicates deliberately; never automatically merge separate users.
3. Apply the migration with the dedicated migration image before upgrading the API. Helm uses the existing pre-upgrade migration hook. A first installation creates the database before its post-install migration; admit traffic after migration completion.
4. Check existing-account login, new registration, GitHub callback when configured, and session revocation.

The new unique index can lock account writes while it builds; schedule large deployments accordingly. Do not edit previously applied migration files. A rollback to Better Auth 1.7.2 requires a reviewed issuer backfill for rows created by the new version before restoring its required constraint/index. Retaining the column does not make an old-binary-only rollback safe.

## Infrastructure and repeatable checks

Nginx's new image is digest-pinned in CI. Traefik chart 41.6.0 includes the Kubernetes-version-aware disruption-budget fix. Helm 4.3 supports the Kubernetes 1.37 tooling used by CI; chart checks cover 1.35.8, 1.36.4, and 1.37.0. See [Nginx downloads](https://nginx.org/en/download.html), [Traefik chart release](https://github.com/traefik/traefik-helm-chart/releases/tag/v41.6.0), and [kind release image digests](https://github.com/kubernetes-sigs/kind/releases/tag/v0.33.0).

Chart-created Gateways now omit the HTTPS listener when TLS is disabled, and their configurable `httpPort` / `httpsPort` default to Traefik’s container entrypoints (8000 / 8443). Exposed Service ports (80 / 443) are separate.

The API pod has a native 10-second `preStop` sleep to allow routing updates before it closes its listener. The minimum 40-second termination grace covers that delay, the app's 25-second stream drain, and cleanup. This uses Kubernetes' lifecycle action without adding a shell to the runtime. See [container lifecycle hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/).

Build `chat-app-client:latest`, `chat-app-server:latest`, and `chat-app-migrate:latest`, then load them into the target local cluster. Run:

```sh
bun run check:k8s <local-or-test-context>
```

The context must be explicit. The runner creates a unique namespace, installs `values.test.yaml` with dummy credentials, waits for migrations, runs the chart's client/API health check, and tests registration, login, session revocation, conversation CRUD, persistence after API replacement, logout, Redis, and pgvector. It waits for old API pods to disappear and does not retry failed application requests. It deletes only the namespace it successfully created. Never use the test values for a user deployment.

CI loads its three built images into kind and runs this same test. This supplements the existing schema/API-server validation. Set `K8S_TEST_GATEWAY_SERVICE` to an existing Traefik Service name (and optionally `K8S_TEST_GATEWAY_NAMESPACE`, default `traefik`) to create a disposable HTTP Gateway and repeat the same API checks through Traefik. The controller must already have Gateway API support enabled and matching listener ports.

The default test uses port forwarding through Nginx and does not claim to validate public TLS, production storage drivers, external OAuth, paid AI-provider calls, or NetworkPolicy enforcement by a production CNI.

## Verification record

- Frozen `bun ci`: no manifest/lockfile changes.
- Full `check:ci`: audit and supply-chain checks, Knip, migration consistency, lint, types, 77 server tests, 18 client tests, both builds, bundle budgets, Docker build checks, and Helm rendering passed.
- Browser: 16 production-bundle tests passed across desktop and mobile; screenshots inspected.
- Client and server containers: non-root/read-only startup checks passed; client entrypoint and Compose template variants passed.
- Kubernetes runtime: complete auth/session/conversation/persistence suite passed on OrbStack 1.35.6+orb1 and kind 1.37.0, including old-pod deletion before repeated reads.
- Traefik 3.7.13 / chart 41.6.0 / Gateway API 1.6.1 on Kubernetes 1.37: the same full runtime journey passed through HTTP Gateway routes and middleware.
- Kubernetes 1.37 schema validation: 26 resources valid, zero invalid, errors, or skipped resources.
- No paid model calls or real GitHub OAuth callbacks were made. Production credentials, production databases, and the user's existing deployments were not changed.
