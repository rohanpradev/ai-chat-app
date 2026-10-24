# Bun 1.4.4 upgrade — October 23, 2026

The user explicitly requested this runtime release. This continues the [engineering review](engineering-review-2026-10-22.md) from starting revision `97360fbdd00bf8e9cfefd0a828ec268c349a6c64`; all earlier application fixes remain included.

## Release applicability

The [official 1.4.4 notes](https://bun.com/blog/bun-v1.4.4) cover faster checking, SQL pool/transaction corrections, improved install resolution, libc-specific optional packages, version-specific release-age exceptions, and the Vitest/jsdom VM fix. These affect this app's existing checks, Drizzle/Bun SQL, isolated workspace installs, and Alpine builds. Runtime fixes arrive through the version upgrade.

| Area | Repository decision |
| --- | --- |
| Runtime | Align package manager, engine floors, Bun types, Docker, Compose, examples, and CI at 1.4.4. |
| SQL | Keep existing database contracts; exercise actual locking, rollback, revisions, ownership, and quota regressions. |
| Install policy | Retain the three-day gate. Permit only the explicitly requested 1.4.4 Bun type releases. |
| Formatting | Keep Biome's established format/lint rules. `bun fmt --doctor` found no existing Prettier/oxfmt configuration. |
| Cache fetching | Existing manifest-first Docker stages already cache installs; no additional whole-graph prefetch stage is justified. |
| Browser tests | Preserve declared Node scripts. Verify the previously failing hook test directly under Bun too. |

There is no reason to replace application SQL with raw COPY/array APIs, adopt compiled executables, or change the streaming protocol for this upgrade. Zod's generated validators still require dynamic code generation, so the strict code-generation flag remains unsuitable.

## Changes and maintained boundaries

The server keeps its application and instrumentation entrypoints, explicit type checks, provider SDKs, runtime-only secrets, and non-root image. The client keeps Vite/Rolldown and lazy rich-content renderers. Shared contracts remain runtime-neutral. Existing conversation schemas and migration SQL are unchanged.

The narrowly scoped Bun type exception is authorized by the requested runtime update. Other newly resolved packages still wait three days; no global minimum-age bypass is used. Dependency choices and final image digests are reviewed with the lockfile and infrastructure notes.

## Acceptance evidence

The following checks were rerun on the stable Bun 1.4.4 dependency graph:

| Check | Observed result |
| --- | --- |
| Frozen installation | `bun ci --no-env-file` passed without lockfile/manifest changes. |
| Security | Online audit: no vulnerabilities across 866 packages. Known supply-chain indicator scan passed. The existing protobufjs postinstall remains blocked. |
| Static checks | Biome, Knip, actionlint, shell syntax, and `git diff --check` passed. Native and TypeScript checks agree across all three workspaces. |
| Unit tests | 122 server and 31 client tests passed. Fourteen opt-in database cases are exercised separately. |
| PostgreSQL | All 14 real concurrency, rollback, immutable revision, ownership, and quota cases passed against pgvector 0.8.7 / PostgreSQL 18. |
| Coverage | Server Bun coverage and client Vitest/V8 coverage passed and produced nonempty LCOV reports. Client line coverage was 48.46%; this is not exhaustive branch coverage. |
| Builds | Client and instrumented server production builds passed. Initial JavaScript: 705.38 KiB against the 800 KiB budget. |
| Browser | All 32 desktop/mobile Chromium journeys passed against the production build; API fixtures make these deterministic. |
| Live Gateway | All 23 checks passed with `openai/gpt-5-mini`; the same 23 passed with `openai/gpt-6-astra`, using synthetic accounts and documents. |
| Containers | Server, client, and migration images built on linux/arm64. Client direct/template startup and server health/readiness passed. Server and migration containers verified Bun 1.4.4, non-root execution, read-only filesystems, and no network. |
| Migrations | History checks and generation passed with no schema changes or generated migration diff. |
| Deployment | Compose, all three Dockerfile checks, Helm matrix/negative cases, official Gateway/Traefik schemas, and native Kubernetes schemas passed. Supported temporary kubectl passed admission dry-run for 26 native resources without persistent cluster changes. |

Live checks cover streaming, history replay, regeneration, abort, signed search approval and denial, structured planning/judging, Jev, PDF attachment reading, upload/vectorization, semantic search, grounded RAG, sessions/profile, quotas, and deletion/logout. External MCP execution was skipped because no disposable-user connection is configured. GitHub OAuth and optional telemetry delivery still require their configured external environments. Synthetic compatibility checks do not establish a general model-quality ranking.

The [dependency follow-up](dependency-upgrade-2026-10-23.md) records selected packages and holds; the [infrastructure review](infrastructure-upgrade-2026-10-23.md) records image identities, cluster observations, schema/admission proof, and stateful rollout requirements. Existing user volumes and the installed global kubectl were not changed.

The targeted real-SDK hook suite passed directly under Bun 1.4.4 before the new dependency refresh: three cases cover completed/regenerated output, partial provider failure, and explicit Stop. Its jsdom initialization failed under 1.4.3 during the earlier review. This is local execution evidence, not an assumption from release notes.

## Rollout

Rebuild the server, client, and migration images together and deploy the matching lockfile. Drain older API workers before using the new snapshot-checked persistence behavior. No application schema migration is required. For an existing pgvector installation, follow the separate infrastructure extension-update runbook.

Observe readiness, session operations, streamed completion/cancellation, approval continuation, upload extraction, vector search, quota settlement, and optional monitoring delivery. Rollback restores the prior application revision, dependency graph, and runtime images together. Never apply a destructive database rollback to compensate for an application/runtime problem.
