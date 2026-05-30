# Project Skills

Use this guide when changing this repository. It is intentionally practical: follow the existing stack, keep CI green, protect the domain language, and update docs when behavior changes.

This repo is a Bun-based chat application with shared TypeScript contracts, a React client, a Hono server, AI SDK streaming/tooling, Docker images, Helm/Kubernetes deployment, and CI validation.

## Prime Directives

- Preserve working behavior before improving structure.
- Prefer the smallest end-to-end slice that can be verified.
- Inspect the codebase before proposing broad changes.
- Use existing scripts, package boundaries, naming, Docker stages, Helm values, and CI patterns.
- Keep shared contracts shared. Do not duplicate DTOs, schemas, message types, model IDs, or tool definitions across client and server.
- Treat generated code, migrations, Helm output, Docker image behavior, streaming behavior, and persisted data as high-risk surfaces.
- Read the final diff before handoff. AI-generated code is a draft, not a decision.

## Core Workflow

1. **Orient first**
   - Read the relevant `package.json` scripts, workspace files, route modules, shared schemas, Dockerfiles, Helm charts, and CI jobs before changing them.
   - Prefer repo-native commands over ad-hoc commands.

2. **Classify the risk**
   - Low risk: isolated implementation or docs change.
   - Medium risk: shared contracts, chat request/response shape, client/server boundary, Docker, Helm, CI, or environment parsing.
   - High risk: persisted data, migrations, auth/security, streaming protocol, deployment shape, production runtime images, or rollback-sensitive behavior.

3. **Make one coherent change**
   - Keep unrelated cleanup out of the patch.
   - Do not combine schema changes, stream changes, persistence changes, UI changes, and deployment changes unless the feature requires it.
   - Prefer a narrow vertical slice over speculative architecture.

4. **Verify early and late**
   - Run the smallest useful check after a meaningful change.
   - Run the broadest practical repo check before handoff.
   - If a command cannot run, state exactly why and name the closest validation that did run.

5. **Handoff clearly**
   - Explain what changed, why, what was verified, what was not verified, and what risk remains.

## Environment And Package Management

- Use Bun `1.3.14+`.
- Keep dependency versions in the root `catalog` when multiple workspaces share them.
- Run `bun install --frozen-lockfile` in CI and before release builds unless the repo explicitly standardizes on another Bun lockfile command.
- Prefer `bun run check` before handing off changes.
- For narrower work, run the affected workspace checks plus the relevant build, Helm, Docker, or migration validation.
- Do not modify lockfiles casually. Manifest and lockfile must agree before handoff.
- When adding a package script that invokes a compiler or tool binary, use `bunx --no-install` so CI fails instead of downloading undeclared tools.
- Keep generated files out of hand edits unless the generator is the source of truth.

Generated or derived paths include:

- `client/src/routeTree.gen.ts`
- `helm/chat-app/values.local.yaml`
- `k8s/traefik-values.generated.yaml`
- `dist/`
- `.vite/`
- `coverage/`
- `*.tsbuildinfo`

## Grill Before Building

Use this for any non-trivial feature, refactor, dependency migration, infrastructure change, or production-facing behavior change.

### Rules

- Walk the decision tree one branch at a time before implementation.
- Ask one blocking question at a time.
- Include the recommended answer and the tradeoff with every question.
- If the answer can be found by reading the codebase, read the codebase instead of asking.
- Stop grilling when implementation shape, validation plan, rollback risk, and docs impact are clear.
- Record durable decisions in docs or this file when they affect future work.

### Good Questions For This Repo

- Does this change affect shared API contracts, persisted data, streaming protocol, or deployment shape?
- Should the implementation live in `shared/`, `server/`, `client/`, Helm, Docker, CI, or Kubernetes configuration?
- What command proves the change works locally?
- What command proves CI will keep it working?
- Is the goal production reliability, developer learning, experiment velocity, or deployment hardening?
- What is the rollback path if this fails after deployment?
- Does this change require README, `CONTEXT.md`, ADR, Helm values, Docker Compose, or CI documentation updates?

## Grill With Docs

Use this when a plan must be stress-tested against project language, existing documentation, ADRs, or code reality.

### Locate The Domain Context

- Look for `CONTEXT-MAP.md` at the repository root.
- If `CONTEXT-MAP.md` exists, treat the repo as multi-context and use it to find the relevant `CONTEXT.md` and `docs/adr/` folders.
- If no map exists, look for root-level `CONTEXT.md` and `docs/adr/`.
- Create files lazily:
  - Create `CONTEXT.md` only when the first domain term is resolved.
  - Create `docs/adr/` only when the first ADR-worthy decision appears.

Expected single-context shape:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

Expected multi-context shape:

```text
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/              # system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/     # context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

### Interview Pattern

- Interview relentlessly until the plan, terminology, edge cases, validation path, and docs impact are understood.
- Ask one question at a time and wait for feedback before continuing.
- Include the recommended answer and tradeoff with every question.
- Do not ask questions that code or docs can answer.
- Resolve upstream domain concepts before downstream implementation details.

### Challenge Language Immediately

- If the user uses a term that conflicts with `CONTEXT.md`, call it out immediately.
  - Example: “Your glossary defines `cancellation` as X, but this plan seems to mean Y. Which meaning should survive?”
- If the user uses fuzzy or overloaded language, propose a canonical term.
  - Example: “You said `account`; do you mean `Customer`, `User`, or `Workspace`?”
- Stress-test relationships with concrete scenarios:
  - partial failure
  - retry
  - cancellation
  - deletion
  - permissions
  - billing
  - streaming interruption
  - stale saved conversations
  - migration rollback

### Cross-Reference With Code

- When the user states how something works, check whether the code agrees.
- If code and plan disagree, surface the contradiction before designing further.
- Prefer exact file paths, route names, schema names, migration names, generated file names, and command outputs over vague summaries.

### Update Documentation Inline

- When a domain term is resolved, update the relevant `CONTEXT.md` immediately.
- `CONTEXT.md` is a glossary only.
- Keep `CONTEXT.md` free of implementation details, specs, TODOs, design notes, and architecture decisions.
- Use `CONTEXT-FORMAT.md` if present.
- If no format exists, keep entries concise:
  - term
  - definition
  - aliases or rejected names
  - one clarifying example when useful
- Do not batch glossary updates until the end of the session.

### Offer ADRs Sparingly

Create or propose an ADR only when all three are true:

1. The decision is hard to reverse.
2. The decision would surprise a future maintainer without context.
3. The decision came from a real tradeoff between alternatives.

If any condition is missing, do not create an ADR.

Use `ADR-FORMAT.md` if present. Otherwise include:

- Status
- Context
- Decision
- Alternatives considered
- Consequences
- Validation notes
- Rollback notes

## Karpathy-Style Engineering Loop

Use this for AI-heavy work, ambiguous behavior changes, hard bugs, model/tooling changes, flaky tests, streaming issues, and agent-assisted coding.

- Become one with the examples before changing abstractions.
- Inspect real requests, messages, routes, logs, fixtures, failing tests, screenshots, and docs.
- Build the smallest end-to-end skeleton first.
- Start with a boring baseline.
- Disable fancy behavior until the simple path is trusted.
- Fix sources of randomness where practical:
  - stable fixtures
  - deterministic tests
  - pinned provider/model settings where available
  - explicit environment parsing
- Overfit one case before generalizing.
- Reproduce one failing conversation, route, chart, Docker build, Helm render, or migration path until it is understood.
- Complexify one thing at a time.
- Do not change schema shape, prompt behavior, streaming format, persistence, and UI rendering in the same unverified step.
- Prefer real failure examples over clever prompt changes.
- Add representative fixtures, eval rows, and regression tests.
- Inspect what the system thinks it is doing:
  - safe metadata
  - message parts
  - stream chunks
  - normalized inputs and outputs
  - tool-call state transitions
- Treat agent output as a proposal. Keep the human responsible for taste, architecture, naming, security, and final diffs.

## Recommended Agent Skills

Use these workflows even when the skill is not installed.

- `grill-me`: use before broad or ambiguous changes to force decisions into the open.
- `grill-with-docs`: use when a change must respect existing domain language, README, `SKILLS.md`, `CONTEXT.md`, ADRs, Helm values, Docker layout, or deployment decisions.
- `karpathy-loop`: use for AI-heavy work, agent-written patches, difficult bugs, and behavior that needs examples, baselines, evals, and one-change-at-a-time iteration.
- `diagnose`: use for regressions, flaky tests, build failures, streaming failures, Docker runtime bugs, Kubernetes issues, and CI failures.
- `tdd`: use for server routes, shared schemas, tool behavior, chat request normalization, model/tool loops, and bug fixes with clear expected behavior.
- `eval-first`: use for LLM prompts, tool loops, streaming metadata, message normalization, AI SDK upgrades, and provider/model changes.
- `zoom-out`: use when touching unfamiliar code paths. First map ownership, data flow, side effects, contracts, and tests.
- `design-an-interface`: use before adding APIs, hooks, tools, service functions, environment schemas, or shared package exports.
- `request-refactor-plan`: use before moving cross-workspace code or changing package boundaries.
- `improve-codebase-architecture`: use periodically to find shallow modules, duplicated contracts, hidden coupling, and orchestration code that should become deeper modules.
- `to-prd` and `to-issues`: use when a conversation becomes a larger feature. Convert it into vertical slices that can be reviewed and tested independently.
- `qa`: use before handoff for a final pass over behavior, docs, tests, security, deployment, and rollback risk.

## TypeScript

- `tsgo` from `@typescript/native-preview` is the only declared TypeScript checker.
- Do not reintroduce `baseUrl`; TypeScript 7 rejects it.
- Use explicit `paths` mappings relative to the owning `tsconfig.json`.
- Keep shared contracts in `shared/`.
- Import shared contracts through `@chat-app/shared` exports instead of duplicating DTOs in client or server code.
- Favor strict, erasable TypeScript:
  - type-only imports
  - no runtime enums unless there is a concrete runtime need
  - no namespaces
  - no JS files in server packages
  - no implicit framework globals
- Keep package exports explicit.
- Avoid circular dependencies between workspaces.
- Do not let client packages import server-only modules, secrets, provider SDKs, database clients, or Node-only runtime code.
- Type errors are design feedback. Do not paper over them with `any`, unchecked casts, or broad `// @ts-ignore` comments.

## React Client

- Treat React 19.2 APIs as available, but introduce them only for a concrete need.
- Use `useEffectEvent` for event-like logic called from effects, not as a dependency escape hatch.
- Keep chat UI state typed as AI SDK `UIMessage` parts.
- Render by `message.parts`, not by assuming a single text field.
- Put server state in TanStack Query.
- Keep route-level data in TanStack Router loaders or validated search params.
- Keep components accessible, focused, and small.
- Use local UI primitives and lucide icons before adding a new UI dependency.
- Lazy-load heavy renderers:
  - Mermaid
  - syntax highlighting
  - media previews
  - artifact previews
- Keep optimistic UI behavior reversible.
- Preserve keyboard navigation, focus states, labels, loading states, and error states.
- Do not leak provider details, server-only metadata, or secret-derived values into client state.

## AI SDK

- Keep AI SDK packages on the same release line.
- This repo currently uses the AI SDK 7 beta line, so pin beta packages deliberately and test streaming after upgrades.
- Validate all client chat requests with shared Zod schemas before model calls.
- Use transport-based `useChat` with `DefaultChatTransport`.
- Keep request shaping in `prepareSendMessagesRequest`.
- Validate streamed metadata with `messageMetadataSchema`.
- For `ToolLoopAgent` chat routes, prefer `createAgentUIStreamResponse` over hand-rolled UI-message conversion and response wrapping.
- Pass these explicitly:
  - `uiMessages`
  - `abortSignal`
  - `timeout`
  - `consumeSseStream`
  - stream options
- Send typed message metadata from the server when available:
  - `createdAt`
  - `model`
  - `finishReason`
  - `totalTokens`
  - `conversationId`
- Use server-side tools only through shared tool definitions and the approval flow.
- Do not let a client request arbitrary tool names, provider options, or model parameters.
- For approval tools, set `needsApproval` on the tool.
- Keep client continuation wired through `lastAssistantMessageIsCompleteWithApprovalResponses`.
- Normalize or remove in-flight tool parts before resubmitting saved conversations.
- Ensure AI SDK validation and model-message conversion receive complete tool states.
- Keep model IDs and provider metadata in `shared/models.ts`.
- Use environment overrides only through documented parsing.
- Preserve streaming semantics:
  - return AI SDK stream responses directly
  - handle tool calls explicitly
  - keep telemetry optional when Langfuse credentials are absent

## Learning AI In Bun And Node.js

- Prefer small, inspectable examples over hidden framework magic.
- Every AI feature should show:
  - request schema
  - model selection
  - stream creation
  - tool approval path
  - UI rendering path
- Keep learning code production-shaped:
  - typed schemas
  - tests
  - telemetry hooks
  - error handling
  - environment validation
- Put reusable AI concepts in `shared/`:
  - model metadata
  - tool IDs
  - UI message types
  - request schemas
- Keep provider-specific code on the server side.
- Client code should talk to app routes, not provider SDKs.
- Add tests around:
  - message normalization
  - tool outputs
  - schema validation
  - stream response behavior
  - saved conversation resubmission
- When adding a tutorial-style example, include:
  - the smallest command that runs it
  - the smallest test that protects it
- Document any AI SDK beta behavior that differs from stable docs so future upgrades do not silently break the learning path.

## Server

- Keep Hono route definitions, handlers, and OpenAPI schemas together by feature directory.
- Validate request input at the boundary.
- Use shared response schemas and HTTP status constants for API behavior that appears in OpenAPI docs.
- Keep auth, tenancy, and permission checks explicit.
- Keep provider-specific behavior behind server boundaries.
- Keep database changes in Drizzle migrations and let CI verify generated migration diffs.
- Prefer explicit transactions for multi-write invariants.
- Never log:
  - secrets
  - auth tokens
  - session tokens
  - prompts with private user data
  - raw provider headers
  - raw provider webhook secrets
- Return safe client errors. Do not expose internal stack traces, provider secrets, or raw database errors.

## Data And Migrations

- Treat persisted data changes as high risk.
- Keep schema definitions, migrations, seed data, and runtime assumptions aligned.
- Do not edit applied migrations casually.
- Make destructive migrations reversible or document backup/rollback expectations.
- Consider old-code/new-code compatibility when deploying database changes.
- Add tests for migration-sensitive behavior when practical.
- If a migration changes API-visible behavior, update shared schemas, client assumptions, and docs together.

## Docker

- Keep the multi-stage Dockerfile structure:
  - manifest copy
  - production dependencies
  - build dependencies
  - client build
  - client runtime
  - server runtime
- Keep Dockerfile syntax on `docker/dockerfile:1`.
- Use BuildKit features deliberately:
  - cache mounts for Bun installs
  - `COPY --link` for independent layers
  - GitHub Actions cache scopes for CI image builds
- Install dependencies before copying source when it improves cache reuse.
- Keep build cache mounts for Bun installs.
- Copy source after dependency installation to preserve cache hits.
- Preserve Bun isolated linker behavior by copying both root `node_modules` and workspace `node_modules` into runtime images.
- Run runtime images as non-root users.
- Keep health checks.
- Avoid installing debug tooling in production stages.
- Do not bake secrets, local env files, test data, or credentials into images.
- Keep `.dockerignore` strict.
- Helm charts, Kubernetes manifests, docs, generated output, tests, local cache directories, and secrets should stay out of image build contexts unless a Dockerfile explicitly needs them.
- If an image argument changes, update Docker Compose, Helm values, CI build commands, and README together.

## Docker Client Runtime

- The client image uses the official nginx entrypoint for Docker Compose envsubst.
- Compose must keep these writable when `read_only: true` is enabled:
  - `/etc/nginx/conf.d`
  - `/run`
  - `/var/cache/nginx`
  - `/tmp`
- The Kubernetes client deployment mounts a rendered ConfigMap at `/etc/nginx/conf.d/default.conf`.
- Kubernetes must bypass the nginx Docker entrypoint and start `nginx -g "daemon off;"` directly.
- Keep both `/run` and `/run/nginx` writable for official nginx and DHI nginx PID paths.

## Helm And Kubernetes

- Keep Helm labels centralized in `_helpers.tpl`.
- Include `app.kubernetes.io/*` labels on every object.
- Render chart validation with representative API versions when templates are conditional on Gateway API or Traefik CRDs.
- Put environment-specific values in values files or generated `values.local.yaml`.
- Do not hard-code local-only settings in templates.
- Keep app workloads production-shaped:
  - probes
  - resources
  - security contexts
  - PDBs
  - HPAs where appropriate
  - NetworkPolicies where appropriate
- Align Kubernetes `runAsUser`, `runAsGroup`, and `fsGroup` with the UID used in the runtime image.
- Bound writable `emptyDir` volumes with size limits.
- Use immutable image references with digests for non-local deployments when available.
- Validate chart changes with `bun run k8s:validate` before merging.
- If ports, probes, env vars, ConfigMaps, Secrets, volumes, or commands change, update README and values examples.

## CI

- CI should install with the lockfile.
- CI should run:
  - Biome
  - Knip
  - Drizzle migration diff checks
  - `tsgo`
  - tests
  - client build
  - Helm validation
  - Docker builds
  - Docker Compose config validation
- Keep CI safe for pull requests from forks.
- Do not expose secrets to untrusted pull request workflows.
- Keep optional external services gated by credentials.
- Never remove a check just to make CI green.
- Fix the source issue, narrow the check correctly, or gate optional integrations behind clear configuration.
- Keep CI output actionable with clear script names and focused failure surfaces.

## Security

- Never log secrets, tokens, cookies, private prompts, raw provider headers, or private user data.
- Do not commit `.env` files or local credentials.
- Do not weaken auth, CORS, webhook verification, permission checks, or deployment security contexts without explicitly calling it out.
- Validate user-controlled input at the boundary.
- Encode or sanitize at the sink when rendering user-controlled content.
- Keep server-only provider SDKs out of client bundles.
- Treat dependency upgrades as security-sensitive when they affect auth, providers, database, runtime, or build tooling.

## Observability And Operations

- Preserve existing logging and telemetry conventions.
- Keep telemetry optional when credentials are absent.
- Add safe metadata when it helps debug production behavior.
- Do not add noisy logs in hot paths without a reason.
- Include request IDs, conversation IDs, provider event IDs, job IDs, or trace IDs when the repo already uses them.
- For production-risk changes, identify how the team will know the change works after deployment.
- For streaming changes, verify both success and abort/error behavior.

## Docs

Update documentation when behavior changes.

Update README or relevant docs for:

- commands
- ports
- environment variables
- deployment URLs
- generated files
- Docker build args
- image names
- runtime commands
- Helm values
- Kubernetes resources
- API contracts
- streaming protocol behavior
- auth/provider setup
- telemetry setup
- migration workflow
- rollback steps

Update `CONTEXT.md` when domain terms change.

Add or update ADRs only for hard-to-reverse, surprising, tradeoff-driven decisions.

For pure config or docs changes, run the closest validation command and state any command that could not be run.

## Done Criteria

A change is not done until the relevant items are true:

- Manifest and lockfile agree.
- Formatting/linting passes.
- Type checks pass.
- Tests pass, or missing tests are explicitly justified.
- Affected builds pass.
- Drizzle migration diff checks pass when database code changed.
- AI SDK streaming behavior is tested when chat, tools, metadata, or message normalization changed.
- Docker build or Docker Compose config validation passes when container behavior changed.
- Helm validation passes when Kubernetes behavior changed.
- README, `CONTEXT.md`, ADRs, or operational docs are updated when behavior changed.
- CI remains safe for pull requests from forks.
- Optional external services are gated by credentials.
- The final diff has been inspected.
- The final handoff states what changed, what was verified, what was not run, and what remains risky.

## Handoff

Use this when compacting the current conversation for another agent.

- Write a handoff document summarizing the current conversation so a fresh agent can continue the work.
- Save it to a path produced by `mktemp -t handoff-XXXXXX.md`.
- Read the file before writing to it.
- Suggest the skills to be used, if any, by the next session.
- Do not duplicate content already captured in other artifacts such as PRDs, plans, ADRs, issues, commits, or diffs. Reference them by path or URL instead.
- If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

### Handoff Format

```md
# Handoff

## Current Goal

## What Changed

## Important Context

## Decisions Already Made

## Files Or Artifacts To Read First

## Commands Already Run

## Commands Not Run

## Remaining Risks

## Suggested Next Skills
```
