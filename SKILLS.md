# Project Skills

Use this guide when changing this repository. It is intentionally practical: follow the existing stack, keep CI green, and update docs when behavior changes.

## Core Workflow

- Use Bun `1.3.13+` and keep dependency versions in the root `catalog` when multiple workspaces share them.
- Run `bun install --frozen-lockfile` in CI and before release builds.
- Prefer `bun run check` before handing off changes. For narrower work, run the affected workspace checks plus the relevant build or Helm/Docker validation.
- Keep generated files out of hand edits unless the generator is the source of truth. Notable generated files include `client/src/routeTree.gen.ts`, `helm/chat-app/values.local.yaml`, `k8s/traefik-values.generated.yaml`, `dist/`, `.vite/`, `coverage/`, and `*.tsbuildinfo`.

## Grill Before Building

Use this for any non-trivial feature, refactor, dependency migration, or infrastructure change.

- Walk the decision tree one branch at a time before implementation.
- Ask one blocking question at a time and include the recommended answer with the tradeoff.
- If the answer can be found by reading the codebase, read the codebase instead of asking.
- Stop grilling when the implementation shape, validation plan, rollback risk, and docs impact are clear.
- Record durable decisions in docs or this file when they affect future work.

Good questions for this repo:

- Does this change affect shared API contracts, persisted data, streaming protocol, or deployment shape?
- Should the implementation live in `shared/`, `server/`, `client/`, or the Helm/Docker layer?
- What command proves the change works locally and what command proves CI will keep it working?
- Is this for production reliability, developer learning, or experiment velocity? Optimize differently for each.

## Recommended Agent Skills

These are the most useful external skill patterns for this project. Use them as workflows even when the skill is not installed.

- `grill-me`: use before broad or ambiguous changes to force decisions into the open.
- `grill-with-docs`: use when a change must respect existing README, `SKILLS.md`, Helm values, Docker layout, or future ADRs.
- `diagnose`: use for regressions, flaky tests, build failures, streaming failures, or Kubernetes/Docker runtime bugs.
- `tdd`: use for server routes, shared schemas, tool behavior, chat request normalization, and bug fixes with clear expected behavior.
- `improve-codebase-architecture`: use periodically to find shallow modules, duplicated contracts, and orchestration code that should become deeper modules.
- `request-refactor-plan`: use before moving cross-workspace code or changing package boundaries.
- `design-an-interface`: use before adding APIs, hooks, tools, service functions, environment schemas, or shared package exports.
- `to-prd` and `to-issues`: use when a conversation becomes a larger feature. Convert it into vertical slices that can be reviewed and tested independently.
- `zoom-out`: use when touching unfamiliar code paths. First map ownership, data flow, side effects, and tests.
- `qa`: use before handoff for a final pass over behavior, docs, test gaps, security, and deployment impact.

## TypeScript

- `tsgo` from `@typescript/native-preview` is the only declared TypeScript checker.
- Do not reintroduce `baseUrl`; TypeScript 7 rejects it. Use explicit `paths` mappings relative to the owning `tsconfig.json`.
- Keep shared contracts in `shared/` and import them through `@chat-app/shared` exports instead of duplicating DTOs in client or server code.
- Favor strict, erasable TypeScript: type-only imports, no runtime enums or namespaces, no JS files in server packages, and no implicit framework globals.
- When adding a package script that invokes a compiler binary, use `bunx --no-install` so CI fails instead of downloading an undeclared tool.

## React Client

- Treat React 19.2 APIs as available, but introduce them only for a concrete need. Use `useEffectEvent` for event-like logic called from effects, not as a dependency escape hatch.
- Keep chat UI state typed as AI SDK `UIMessage` parts. Render by `message.parts`, not by assuming a single text field.
- Put server state in TanStack Query and keep route-level data in TanStack Router loaders or validated search params.
- Keep components accessible and small. Use the local UI primitives and lucide icons before adding a new UI dependency.
- Lazy-load heavy renderers such as Mermaid, syntax highlighting, media, and artifact previews.

## AI SDK

- Keep AI SDK packages on the same release line. This repo currently uses the AI SDK 7 beta line, so pin beta packages deliberately and test streaming after upgrades.
- Validate all client chat requests with shared Zod schemas before model calls.
- Use transport-based `useChat` with `DefaultChatTransport`; keep request shaping in `prepareSendMessagesRequest` and validate streamed metadata with `messageMetadataSchema`.
- For `ToolLoopAgent` chat routes, prefer `createAgentUIStreamResponse` over hand-rolled UI-message conversion and response wrapping. Pass `uiMessages`, `abortSignal`, `timeout`, `consumeSseStream`, and stream options explicitly.
- Send typed message metadata from the server for `createdAt`, `model`, `finishReason`, `totalTokens`, and `conversationId` when available.
- Use server-side tools only through the shared tool definitions and approval flow. Do not let a client request arbitrary tool names or provider options.
- For approval tools, set `needsApproval` on the tool and keep client continuation wired through `lastAssistantMessageIsCompleteWithApprovalResponses`.
- Normalize or remove in-flight tool parts before resubmitting saved conversations so AI SDK validation and model-message conversion receive complete tool states.
- Keep model IDs and provider metadata in `shared/models.ts`; use environment overrides only through documented parsing.
- Preserve streaming semantics: return AI SDK stream responses directly, handle tool calls explicitly, and keep telemetry optional when Langfuse credentials are absent.

## Learning AI In Bun And Node.js

- Prefer small, inspectable examples over hidden framework magic. Every AI feature should show the request schema, model selection, stream creation, tool approval path, and UI rendering path.
- Keep learning code production-shaped: typed schemas, tests, telemetry hooks, error handling, and env validation still apply.
- Put reusable AI concepts in `shared/`: model metadata, tool IDs, UI message types, and request schemas.
- Keep provider-specific code on the server side. Client code should talk to app routes, not provider SDKs.
- Add tests around message normalization, tool outputs, schema validation, and stream response behavior before adding more model features.
- When adding a tutorial-style example, include the smallest command that runs it and the smallest test that protects it.
- Document any AI SDK beta behavior that differs from stable docs so future upgrades do not silently break the learning path.

## Server

- Keep Hono route definitions, handlers, and OpenAPI schemas together by feature directory.
- Use shared response schemas and HTTP status constants for API behavior that appears in OpenAPI docs.
- Keep database changes in Drizzle migrations and let CI verify generated migration diffs.
- Never log secrets, auth tokens, prompts with private user data, or raw provider headers.

## Docker

- Keep the multi-stage Dockerfile structure: manifest copy, production dependencies, build dependencies, client build, client runtime, server runtime.
- Keep Dockerfile syntax on `docker/dockerfile:1` and use BuildKit features deliberately: cache mounts for Bun installs, `COPY --link` for independent layers, and GitHub Actions cache scopes for CI image builds.
- The client image uses the official nginx entrypoint for Docker Compose envsubst, so Compose must keep `/etc/nginx/conf.d`, `/run`, `/var/cache/nginx`, and `/tmp` writable when `read_only: true` is enabled.
- Preserve Bun isolated linker behavior by copying both root `node_modules` and workspace `node_modules` into runtime images.
- Run runtime images as non-root users, keep health checks, and avoid installing debug tooling in production stages.
- Keep build cache mounts for Bun installs and copy source after dependency installation to preserve cache hits.
- Keep `.dockerignore` strict. Helm charts, Kubernetes manifests, docs, generated output, tests, local cache directories, and secrets should stay out of image build contexts unless a Dockerfile explicitly needs them.
- If an image argument changes, update Docker Compose, Helm values, CI build commands, and README together.

## Helm And Kubernetes

- Keep Helm labels centralized in `_helpers.tpl` and include `app.kubernetes.io/*` labels on every object.
- Render chart validation with representative API versions when templates are conditional on Gateway API or Traefik CRDs.
- The Kubernetes client deployment mounts a rendered ConfigMap at `/etc/nginx/conf.d/default.conf`, so it must bypass the nginx Docker entrypoint and start `nginx -g "daemon off;"` directly. Keep both `/run` and `/run/nginx` writable for official nginx and DHI nginx PID paths.
- Put environment-specific values in values files or generated `values.local.yaml`; do not hard-code local-only settings in templates.
- Keep probes, resources, security contexts, PDBs, HPAs, and NetworkPolicies on app workloads.
- Align Kubernetes `runAsUser`/`runAsGroup`/`fsGroup` with the UID used in the runtime image, and bound writable `emptyDir` volumes with size limits.
- Use immutable image references with digests for non-local deployments when available.
- Validate chart changes with `bun run k8s:validate` before merging.

## CI And Docs

- CI should install with the lockfile, run Biome, Knip, Drizzle migration diff checks, `tsgo`, tests, client build, Helm validation, Docker builds, and Docker Compose config validation.
- Update README when commands, ports, environment variables, deployment URLs, or generated files change.
- Add focused tests for behavior changes. For pure config or docs changes, run the closest validation command and state any command that could not be run.
