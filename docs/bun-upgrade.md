# Bun 1.4.3 upgrade audit

Reviewed on October 15, 2026 against the [1.4.3 release notes](https://bun.com/blog/bun-v1.4.3), [official releases](https://github.com/oven-sh/bun/releases), and [type-checking documentation](https://bun.com/docs/runtime/check). The repository previously targeted 1.4.2; the local runtime already runs 1.4.3.

## File plan

| Files | Planned change |
| --- | --- |
| `package.json` | Pin the package manager, declare the minimum runtime, and dispatch the workspace-native type checks. Keep `typecheck:tsc` for comparison and fallback. |
| `server/package.json` | Update the runtime floor and both Bun type packages; use native type checks for typecheck, development, and tests while retaining the preload and isolated test worker. |
| `client/package.json` | Use native type checks and require them before standalone production builds and bundle reports. Preserve Vite and Vitest. |
| `shared/package.json` | Use native type checks while keeping the package runtime-neutral. |
| `bun.lock` | Regenerate with Bun, changing only the Bun type dependencies and their required resolution metadata. |
| `server/scripts/build.ts` | Enable `Bun.build({ check: true })` and explicitly select the server tsconfig. Keep both entrypoints, Sentry instrumentation, and external dependencies. |
| `knip.json` | Recognize the new Bun `check` subcommand in each workspace; Knip 6.39 otherwise reports it as an unlisted executable. |
| `Dockerfile`, `server/Dockerfile.migrate` | Update the Bun base version while preserving stages, isolated dependency copies, and non-root execution. |
| `compose.yml`, `.env.example`, `server/.env.example` | Align default build/runtime images, including stale 1.4.0 server examples. |
| `.github/workflows/ci.yml`, `.github/workflows/sonar.yml` | Use 1.4.3; update the CI multi-platform image digest and the type-check step label. |
| `README.md`, `client/README.md`, `server/README.md`, `k8s/README.md`, `docs/supply-chain.md` | Document the runtime requirement, native checker, fallback, build behavior, image maintenance, and rollout. |
| `docs/bun-upgrade.md` | Preserve this plan, the full feature applicability audit, validation evidence, and rollback notes. |

## Feature applicability

The audit covered every tracked source/configuration file and existing untracked MCP work. Search targets included Bun APIs, package scripts, builds, HTTP and fetch calls, timers, SQL, Redis, authentication, compression, file I/O, tests, containers, and operations. Existing unrelated work is preserved.

| Release area | Repository seam and decision |
| --- | --- |
| Native type checking | Adopt in the three workspace scripts, server development/tests, server bundler, and client build gate. Keep TypeScript 7.0.2 for editor support and `typecheck:tsc`. |
| Idle CPU, engine, promises, HTTP performance | Runtime-only benefit to `server/src/index.ts`, Hono routes, JSON handling, shutdown, and concurrent services; no source rewrite needed. |
| TLS, proxy, trust-store, HTTP parsing fixes | Runtime-only benefit to `server/src/db/index.ts`, Redis middleware, AI Gateway, MCP transports, model catalog, Scalar, and Serper fetches. Preserve certificate verification and existing network allowlists. Review private CA/proxy configuration during rollout. |
| `Bun.FetchSession` | Reviewed all server fetch sites. Current callers do not need distinct TLS/proxy policies or connection pools; keep their established fetch and lifecycle behavior. Revisit for a concrete per-provider transport requirement. |
| `Bun.ModuleGraph` | Experimental; no current in-process application-instance requirement. Keep the existing process model. |
| Code-generation restriction | Defer: `server/src/index.ts` imports `zod/compile`, which intentionally generates validators. Blocking string compilation needs a separate compatibility/performance decision. |
| Compression levels | No server `CompressionStream` consumer; nginx owns response compression. Preserve unbuffered SSE. |
| Conditional file ranges | No Bun file-download route; nginx serves frontend assets and profile uploads use the existing application contract. |
| Install improvements and hardening | Receive through the version upgrade. Preserve `bunfig.toml`, the isolated linker, frozen installs, and the 72-hour release-age gate. |
| Bundler memory, wider hashes, metafile improvements | Runtime benefit to server builds; two fixed-name entrypoints need no split-chunk hashes or new analysis pipeline. Client bundling remains Vite/Rolldown. |
| Compiled executable / bytecode features | No compiled executable is deployed. Preserve the instrumented JavaScript bundles and container startup path. |
| Runtime, streams, Node compatibility, test isolation fixes | Exercise existing server/client suites, production builds, browser journeys, and deployment checks. Retain `--parallel=1` test isolation and required environment preload. |
| SQL fixes | Existing Drizzle/Bun SQL integration receives the runtime fixes. Keep transactions and query encoding unchanged; flag changed failed-transaction reporting for rollout monitoring. |
| SQLite, S3, image, markdown, Windows-only APIs | No applicable server consumers. Browser markdown rendering and frontend image handling remain browser-compatible. |
| Coverage reporter inference | Keep explicit `--coverage` in Sonar for clarity; the new implicit behavior needs no configuration change. |
| Type declarations | Upgrade both existing Bun type packages together so native build options and runtime APIs match. |

No changes are needed to schemas, persisted data, generated migrations, generated routes, Helm templates/values, Kubernetes scripts, Make targets, auth, AI prompts, or browser rendering. Helm deploys application images rather than the Bun base image directly.

## Verification and rollout

Acceptance: all runtime/build/CI pins target 1.4.3, both native and TypeScript checks agree, invalid types stop builds/tests, manifests and lockfile agree, and applicable existing checks pass.

Before implementation, TypeScript checks and native checks passed for server (97 files), client (186 files), and shared (21 files). Run native checks from each workspace: the root `check` package script shadows the bare `bun check` command at the repository root. Use `bun run typecheck` there.

CI's verified `oven/bun:1.4.3-alpine` multi-platform digest is `sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373` (linux/amd64 and linux/arm64). The release moves that image to Alpine 3.24; build and smoke-test the resulting server and migration images in CI.

The review fixed point is commit `db3294e0c5b2cc5714a45373811f430d9de248b0` plus the existing working-tree changes captured before implementation. The final review compared edits against that working-tree baseline as well as HEAD. Existing application/MCP changes, generated routes, migrations, and local generated deployment files were preserved.

| Check | Observed result |
| --- | --- |
| `bun ci` | Passed; frozen install made no changes. |
| `bun run security:check` | Passed; registry audit checked 886 packages with no vulnerabilities; known supply-chain indicator scan passed. |
| `bun run lint` | Passed, 189 files. |
| `bun run knip` | Passed after the narrowly scoped Bun subcommand compatibility configuration. |
| `bun run typecheck` | Passed all three workspaces with the built-in checker. |
| `bun run typecheck:tsc` | Passed all three workspaces with TypeScript 7.0.2. |
| `bun run --filter @chat-app/server test` | 102 tests passed across 19 files with `--check`, the environment preload, and one isolated worker. |
| `bun run --filter @chat-app/client test` | 28 tests passed across 9 files. |
| `bun run check:migrations` | Passed; no schema changes or new migration output. |
| `bun run build` | Both production builds passed, including the Sentry-instrumented server entrypoints. |
| `bun scripts/report-client-bundle-size.mjs` | Passed initial/total JavaScript budgets against the production build. |
| `bun run test:e2e` | All 28 desktop/mobile Chromium journeys passed against the production build. Only non-failing color-environment warnings were emitted. |
| Client `test:coverage` and server `test --coverage --coverage-reporter=lcov --coverage-dir=coverage` | Passed; both nonempty LCOV reports verified. |
| `DEPLOY_CHECK_USE_VALUES_TEMPLATE=1 DEPLOY_CHECK_REQUIRE_DOCKER=1 bun run check:deploy` | Compose validation, all three Dockerfile build checks, and Helm lint/render/negative validation passed for Kubernetes 1.35.9, 1.36.5, and 1.37.1. No Dockerfile check warnings. |
| Compiled server smoke test | With dummy credentials and environment-file loading disabled, root and `/api` health/readiness returned their expected statuses. SIGTERM completed resource shutdown and exited 0. This exercises the host runtime rather than Alpine. |
| Deliberate type-error probes | Actual server/client build scripts rejected TS2322 without modifying existing artifacts. The server test script rejected an invalid test before its body ran. All temporary probes were removed and the original server entrypoint restored byte-for-byte. |
| Version and diff review | No stale Bun pins remain in maintained files; only the two Bun type-package records and specs changed in the existing lockfile. `git diff --check` passed. Local environment files contain no direct Bun image override. |

Client tests/coverage/browser checks used the bundled Node executable on PATH, as required by this repository's existing Vitest/jsdom setup. Application and server tooling remained on Bun. The complete CI gate was exercised by its individual commands. The Docker and Kubernetes follow-up below closes the initially unavailable container/cluster verification. Live provider calls and private TLS/proxy integration remain environment-specific rollout checks.

## Docker and Kubernetes follow-up

The follow-up audit kept the existing multi-stage images, isolated workspace layout, migration Job, non-root UID/GID, bounded writable mounts, security contexts, probes, network policies, retained data volumes, and unbuffered SSE configuration. Real image builds and a deployed test stack verified those settings with Bun 1.4.3 on Alpine.

Additional fixes:

- `Makefile` now accepts Kubernetes 1.35-1.37, matching the chart and deployment matrix. Previously it incorrectly rejected 1.37.
- `scripts/check-k8s-versions.mjs`, the root `check:k8s-versions` command, and the Make prerequisite flow validate structured version data and reject unsupported kubectl/server skew. `scripts/check-deployments.mjs` exercises all three supported minors and the skew rejection. Additional direct fixtures verified rejection of 1.34, 1.38, and clients more than one minor away.
- CI uses [Helm 4.3.1](https://github.com/helm/helm/releases/tag/v4.3.1), adds the Kubernetes compatibility gate, and checks the migration image's runtime version and non-root execution. Its existing published kind 1.37.0 image and schemas remain pinned; the latest published Kubernetes release verified during this audit is 1.37.1.
- `scripts/check-server-container.mjs` now checks the actual runtime version and non-root UID. `scripts/check-k8s-runtime.mjs` checks Bun inside the deployed API pod. Both compare with the existing root package-manager pin instead of duplicating its version.
- The server environment example now matches the root Nginx 1.31.6 default. Kubernetes/chart runbooks describe the compatibility gate and deployed runtime check; the chart README's missing modernization link was replaced with current runbooks.

Observed follow-up results:

| Check | Result |
| --- | --- |
| Actual server, frontend, migration Docker builds with `--pull` | All passed on linux/arm64. |
| Server container under read-only/no-network/capability-drop settings | Bun 1.4.3, non-root UID, health, and readiness verified. |
| Frontend container | Direct nginx startup and Compose runtime template substitution both passed, including preserved nginx request variables and unbuffered SSE. |
| Migration container under read-only/no-network/capability-drop settings | Bun 1.4.3 and non-root execution verified. |
| Make prerequisites | Passed against OrbStack Kubernetes 1.36.5 with kubectl 1.37.1 and Helm 4.3.1. |
| Real Kubernetes API admission | Production manifests accepted with server-side dry-run; no resources created. |
| Disposable Kubernetes runtime test | Passed nginx/API health, schema migrations, registration/login, session revocation/logout, pgvector 0.8.6, Redis, and persisted sessions/conversations after replacing the API pod. Bun 1.4.3 verified in the pod. The test namespace was deleted afterward. |
| Configuration checks | Dockerfile checks, Compose parsing, supported Kubernetes renders, negative values/skew cases, lint, Knip, and YAML parsing passed. |

The live cluster was 1.36.5; the 1.37 runtime matrix remains covered by CI's kind job. No existing user namespace or data was modified. The host's global kubectl remains 1.33.9; tests used an official checksum-verified 1.37.1 binary from a temporary directory without replacing host tools. Update the installed kubectl to a compatible version before using the ordinary Make workflow; the prerequisite failure now gives an explicit instruction rather than relying on an unsupported client. See the [upstream compatibility policy](https://kubernetes.io/releases/version-skew-policy/).

No deployment or data migration is part of this upgrade. Monitor readiness, TLS/proxy failures, SQL transaction errors, SSE completion/abort, and graceful shutdown when rolling out. Roll back by rebuilding the previous application revision with its matching Bun version and lockfile. A fallback from native checking alone can use `bun run typecheck:tsc`; older Bun versions also require removing the new `--check`/build-check options.
