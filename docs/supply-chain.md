# Dependency Maintenance

The workspace manifests, root catalog, and committed `bun.lock` are the version sources of truth. Use `bun ci` for reproducible installs and retain the three-day release-age policy in `bunfig.toml`. Client tests use the Node release in `.nvmrc`; the application, server tests, installs, builds, and native type checks use Bun.

## Updating Dependencies

Run `bun outdated --filter '*'`, read the affected upstream release and migration notes, then use `bun update --recursive` for compatible updates. Review major releases and root overrides separately before widening ranges. Check package ownership, lifecycle scripts, native downloads, peer dependencies, and lockfile changes. Grant lifecycle-script trust only when the script is required and reviewed; the existing protobufjs postinstall remains blocked.

Keep the Bun package-manager pin, engine floors, Bun types, Docker defaults, the root environment example, and CI workflows aligned. Update image tags and verified multi-platform digests together. `bun run check:toolchain` checks those pins; CI and deployment validation run it automatically. `bun run typecheck:tsc` retains the TypeScript comparison to the native Bun checks.

## Bun 1.4.4 Review

Reviewed the [Bun 1.4.4 release](https://bun.com/blog/bun-v1.4.4) against this workspace's install, build, test, HTTP streaming, database, and deployment paths.

| Release area | Application decision |
| --- | --- |
| Native type checking | Keep `bun check` in every workspace, `--check` in server development/tests, and `Bun.build({ check: true })`. CI also runs the declared TypeScript comparison. |
| Runtime and type alignment | Pin both Bun type packages exactly to 1.4.4. The toolchain guard checks manifest requirements and every resolved lockfile copy before local checks; ranges could otherwise admit APIs absent from production. |
| Package installation | Keep frozen installs, the isolated linker, the three-day release-age policy, and version-specific type exceptions. Retry/backoff and peer-resolution fixes apply through Bun; frozen installs retain the reviewed graph. |
| Linux native dependencies | Retain libc metadata in `bun.lock`; Alpine image installs select musl packages, while Linux CI uses its native libc. |
| Database and streaming | The existing Bun SQL driver, fetch, response streams, Redis, and password APIs receive runtime fixes. Validate persistence races and usage accounting with the disposable PostgreSQL suite before rollout. |
| Formatting | Keep Biome as the formatter, linter, and import organizer. `bun fmt` does not replace these combined checks; adopting it requires a separate formatting decision. |
| Optional APIs and tooling | No current requirement for SQL COPY streams or name transforms, WebSocket changes, SQLite hooks, Yarn migration, publishing, or package extensions. Existing Docker manifest stages already cache dependency installation; fetch/offline and cache archives remain optional optimizations. |

Rebuild server and migration images together when changing Bun. Check readiness, interrupted streams, saved-history revisions, and quota settlement; restore the previous image digests, manifests, and lockfile together if these regress.

## Compatibility Constraints

| Integration | Required coordination |
| --- | --- |
| AI SDK | Keep core, React, MCP, telemetry, provider, and provider utilities on matching release contracts. Preserve streaming, tool approval, persisted-message validation, and usage semantics; follow the [AI SDK migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0). |
| OpenTelemetry and Langfuse | Keep API `~1.9.1` with SDK Node 0.223/core 2.12. API 1.10 is outside that SDK's peer range, and SDK 3 is outside Langfuse's current SDK 2 peer contracts. [Langfuse 6](https://langfuse.com/docs/observability/sdk/upgrade-path/js-v5-to-v6) also requires Cloud or self-hosted 4.59.0+, so establish backend compatibility before upgrading from 5. |
| Renderers | Keep Babel 7 and Mermaid 11 within their consumers' supported major lines. KaTeX 0.18.11 is a security override outside several consumers' declared 0.16 ranges; keep renderer and stylesheet paired and verify code, math, and Mermaid in the browser before changing it. |
| Filesystem tooling | Override transitive `glob` to 14.0.2 for [cancellation safety](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4); its dependency graph also resolves patched [minimatch 11.0.2](https://github.com/advisories/GHSA-g3hv-75wg-m249). This crosses the ranges declared by Rimraf and Sentry's bundler plugin; retain cleanup/glob smoke checks and production-build validation, and remove the override when both parents accept patched versions. |
| Drizzle | Keep ORM and Kit paired at 1.0.0-rc.5. Version 9 snapshots are generator-owned; older Kit cannot read them. Restore source, snapshots, and lockfile together when rolling back. Do not rewrite historical migration SQL. |
| Sentry | Keep SDK and Vite-plugin releases aligned. Source-map upload requires explicit credentials and a supported backend; the current plugin requires self-hosted Sentry 26.4.2+. Review span-origin changes when maintaining external alert/query rules. |

## Verification and Rollout

Run `bun run check:ci` and `bun run test:e2e` before release. For database and AI changes, use the disposable-service checks in the [evaluation guide](evals.md). Rebuild client, server, and migration images together with the matching lockfile.

The migration image must include its tsconfig aliases and every schema dependency. Its build imports the schema, and `bun run check:migrate-container <image>` requires warning-free snapshot comparison and no-op generation as a non-root user with a read-only filesystem and no network. A Drizzle command exiting zero after skipping schema comparison is a failure.

During rollout, observe readiness, session revocation, streamed completion/interruption/cancellation, saved-history replay, approvals, usage accounting, and optional telemetry delivery. Roll back application images and the dependency graph together if those checks regress. Database/extension and Redis rollback require the [stateful-service precautions](../k8s/README.md#images).

## Supply-Chain Incidents

`bun run security:check` combines the registry audit with known compromised-version and suspicious-artifact checks. Preserve evidence and stop executing a suspicious package; investigate on an isolated machine, replace the dependency, regenerate the lockfile, and repeat validation. Rotate credentials exposed to confirmed malicious code and review repository/workflow changes before restoring builds.
