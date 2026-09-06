# Chat App

AI chat application built with a Bun workspace, React client, Hono API, PostgreSQL, Redis, and the AI SDK.

![Biome](https://img.shields.io/badge/biome-%2360A5FA.svg?style=for-the-badge&logo=biome&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Helm](https://img.shields.io/badge/helm-%230F1689.svg?style=for-the-badge&logo=helm&logoColor=white)
![Hono](https://img.shields.io/badge/hono-%23E36002.svg?style=for-the-badge&logo=hono&logoColor=white)
![Nginx](https://img.shields.io/badge/nginx-%23009639.svg?style=for-the-badge&logo=nginx&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Traefik](https://img.shields.io/badge/Traefik-%2300314b.svg?style=for-the-badge&logo=traefikproxy&logoColor=white)
![Zod](https://img.shields.io/badge/zod-%233068b7.svg?style=for-the-badge&logo=zod&logoColor=white)

![Chat App demo](docs/assets/app-demo.gif)

## Overview

The repo is organized as a Bun workspace with three packages:

- `client/` - React app built with Vite and TanStack Router
- `server/` - Hono API, auth, AI streaming, and database code
- `shared/` - shared schemas, model metadata, tool definitions, and UI message types

The repo also includes a Helm chart under `helm/chat-app/` and helper scripts for local Kubernetes workflows.

## Features

- Streaming chat responses through the AI SDK
- Cookie-based auth for register, login, logout, and current user
- Persistent conversations in PostgreSQL
- Shared Zod schemas and TypeScript types across client and server
- Structured output endpoints for planning and LLM-as-judge evaluation
- Approval-gated web search with Serper
- File attachments in chat input
- Mermaid rendering loaded lazily for markdown diagrams
- Optional Langfuse telemetry through OpenTelemetry
- Optional Sentry monitoring for client, server, and AI SDK operations
- Docker Compose and local Kubernetes workflows

## Stack

- Runtime and package manager: Bun
- Frontend: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS
- Backend: Hono, Drizzle ORM, Zod, OpenAPI metadata
- AI: AI SDK, OpenAI provider, Langfuse telemetry
- Data: PostgreSQL, Redis
- Infra: Docker, Nginx, Traefik, Helm, Kubernetes Gateway API

## Repository Layout

```text
client/                 React client
server/                 Hono API and database code
shared/                 Shared contracts and AI/tool definitions
helm/chat-app/          Helm chart
scripts/                Local deployment and setup helpers
compose.yml             Docker Compose stack
Dockerfile              Client and server production images
Makefile                Common local, Docker, and Kubernetes commands
docs/                   Architecture, security, eval, and policy docs
```

## Prerequisites

- Bun `1.4.2` (matches CI and the production runtime)
- Docker Desktop or OrbStack
- `kubectl` and `helm` for Kubernetes workflows
- OpenAI API key

Optional:

- Serper API key for web search
- Langfuse keys for telemetry
- GitHub OAuth credentials for the GitHub login provider

## Setup

Create a local `.env`:

```bash
make setup
```

Then edit `.env`. At minimum set:

```text
OPENAI_API_KEY=
BETTER_AUTH_SECRET=
DB_PASSWORD=
```

For GitHub login:

```text
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

For Docker or Kubernetes, set `CLIENT_URL` or `BETTER_AUTH_URL` to the public app origin used by the browser, for example `https://localhost` or `https://app.docker.localhost`.

For web search:

```text
SERPER_API_KEY=
```

For Langfuse:

```text
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Validate the required values:

```bash
make validate
```

## Local Development

Install dependencies:

```bash
bun ci
```

Run the client and server directly:

```bash
make local
```

Or start the Bun workspace dev scripts from the root:

```bash
bun run dev
```

Default local URLs:

- Client: `http://localhost:5173`
- Server: `http://localhost:3000`

Useful checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run security:check
bun run build
bun run check:deploy
```

Or run the combined check:

```bash
bun run check
```

## Docker

The Compose stack pins current public upstream images (Bun 1.4.2, Nginx 1.31.5, Traefik 3.7.12, pgvector 0.8.6 on PostgreSQL 18, Redis 8.10.1, and Docker Socket Proxy 0.5.0) so a fresh local setup is reproducible and does not require private registry credentials. Production can override `DOCKER_SOCKET_PROXY_IMAGE`, `BUN_DEV_IMAGE`, `BUN_RUNTIME_IMAGE`, `NGINX_IMAGE`, `TRAEFIK_IMAGE`, `POSTGRES_IMAGE`, and `REDIS_IMAGE` with reviewed, digest-pinned images.

Compose uses the official Nginx entrypoint and a writable, temporary `/etc/nginx/conf.d` to render `BASE_API_SLUG`, `SERVER_HOST`, and `SERVER_PORT` at startup. Nginx request variables are preserved by an explicit substitution filter. Compose Nginx overrides must provide `/docker-entrypoint.sh` and its template support. Kubernetes starts Nginx directly with a chart-rendered ConfigMap, which also supports shell-less image overrides.

CI checks both Nginx startup modes and probes the compiled server's health and readiness in a non-root, read-only container with networking disabled. Run `bun run check:client-container <image>` and `bun run check:server-container <image>` after building custom images. The server smoke check uses dummy credentials and does not exercise database, Redis, or provider connectivity.

Start the full local stack:

```bash
make start
```

This starts the configured container runtime when possible, rebuilds the application images, and waits for every service plus both public health routes before returning. The stack includes Traefik, its private read-only Docker API proxy, PostgreSQL, Redis, the migration job, API server, and client. Traefik never mounts the host Docker socket directly; the proxy exposes only container discovery, network discovery, events, ping, and version reads on an internal-only network. Discovery is limited by the project-owned `com.chatapp.traefik.scope=edge` label because Traefik reserves `traefik.*` labels for routing configuration. Outbound version and anonymous-usage checks are disabled because releases are pinned and reviewed explicitly.
Traefik 3.7's stricter encoded-path protections remain enabled. Relax `encodeQuerySemicolons`, `sanitizePath`, or encoded-character handling only for a backend with a verified RFC 3986 compatibility requirement and matching route tests.
The server image compiles the Hono entrypoint and its observability preload during the Docker build with `bun run --filter @chat-app/server build`, then starts `dist/index.js` with `dist/instrumentation.js` preloaded. Sentry's Bun build plugin instruments Hono during compilation, while the preload initializes Sentry before the transformed Hono module loads; production startup does not execute TypeScript source.

Useful commands:

```bash
make status
make logs
make health
make stop
make clean
```

`make clean` removes recreatable application resources, local app images, project-owned Bun development processes, and generated workspace artifacts. It deliberately preserves Docker named volumes, Kubernetes PVCs, shared ingress controllers, namespaces, and the local Kubernetes runtime. Data deletion is explicit: use `make docker-destroy-data CONFIRM=chat-app` or `make k8s-destroy-data CONFIRM=chat-app` only after taking any required backup.

URLs:

- App: `https://localhost`
- App/Nginx health: `https://localhost/health`
- API health through the proxy: `https://localhost/api/health`
- Langfuse Cloud: `https://cloud.langfuse.com`

Validate the Docker and deployment configuration without starting the stack:

```bash
docker compose config --quiet
bun run check:deploy
```

## Kubernetes

The Kubernetes flow uses Helm and values generated from the repo-root `.env`.

For the full local Gateway setup with Traefik:

```bash
# K8S_GATEWAY_ENABLED=true in .env
make kubernetes
```

This will:

1. Validate `.env` and install the exact dependency graph from `bun.lock`
2. Run the complete security, lint, type, test, build, Docker, Helm, and Kubernetes CI gate
3. Install or upgrade Traefik when Gateway mode is enabled
4. Generate local Helm values and browser-trusted local TLS when `mkcert` is available
5. Build the server, client, and migration images
6. Deploy the app chart
7. Run database migrations
8. Run rollout, Helm, and external health smoke tests
9. Print status and URLs

Useful commands:

```bash
make k8s-full-stack
make k8s-status
make k8s-logs
make k8s-cleanup
make k8s-stop
```

The chart renders client/server Deployments, PostgreSQL and Redis StatefulSets, a migration Job, Services, NetworkPolicies, HPA, PDB, probes, optional Gateway API HTTPRoutes, and optional Traefik Middleware CRDs. Local generated values use public Postgres/Redis images and local app images with `pullPolicy: Never`; production values can override every image by registry, tag, or digest. Production defaults reference an externally managed `chat-app-secrets` Secret and never render placeholder credentials. The server is stateless; only PostgreSQL and Redis own persistent storage.

See `helm/chat-app/README.md` for the chart contract and `k8s/README.md` for the full Kubernetes runbook.

## Bun Workspaces

Dependency versions shared across workspaces are defined in the root `catalog` field and referenced with `catalog:` from package manifests.

Use `bun ci` in CI and clean local installs. It is equivalent to a frozen-lockfile install and fails when `package.json` and `bun.lock` drift.

Dependabot uses one root Bun workspace update to keep the catalog, workspace manifests, and shared lockfile together, with a three-day cooldown matching `bunfig.toml`. Dockerfile and Compose image updates are tracked separately. CI builds the public upstream images without registry credentials. Its Bun and Nginx images are pinned to verified multi-platform digests in `.github/workflows/ci.yml`; update those digests together with their version tags.

Sonar client coverage uses `bun run --filter @chat-app/client test:coverage`, backed by Vitest and its matching V8 coverage package. Server coverage uses the server's existing Bun test script so its environment preload and concurrency settings are preserved.

TypeScript checks run through the stable native TypeScript 7 compiler (`tsc`) from `typescript`:

```bash
bun run typecheck
```

The repo uses Bun's isolated linker:

```toml
[install]
linker = "isolated"
minimumReleaseAge = 259200
```

This matters for Docker. The production images copy:

- root `node_modules`, which contains Bun's `.bun` package store
- workspace `node_modules`, which contain the package-local dependency links

Without both parts, imports from `/app/server` or `/app/shared` can fail at runtime.

## AI and Tools

The server uses the AI SDK for streaming responses. The model catalog lives in `shared/models.ts`.

Use `OPENAI_MODEL_OVERRIDES` for comma-separated account-specific or newly released OpenAI model IDs that should appear in the selector before the live model catalog reports them. Keep the default model in `shared/models.ts` unless the candidate passes the eval checklist.

Web search is exposed through the `serper` tool. It is approval-gated, so the UI must explicitly approve a tool call before the server continues the stream.

AI SDK telemetry is enabled when Langfuse or Sentry credentials are present. Each chat, structured generation, RAG, and embedding operation uses a stable identifier, and prompt inputs and model outputs are excluded from traces. Langfuse exports AI SDK spans through OpenTelemetry; Sentry records AI operations and explicitly captured stream failures when `SENTRY_DSN` is configured.

## Security and Operations Docs

- `SECURITY.md` - vulnerability reporting and supported security posture
- `docs/security.md` - runtime, proxy, secret, and deployment hardening notes
- `docs/supply-chain.md` - Bun/npm supply-chain policy and Shai-Hulud response playbook
- `docs/ai-architecture.md` - agent, tool, streaming, and observability architecture
- `docs/model-policy.md` - model catalog and upgrade policy
- `docs/evals.md` - release evaluation checklist for AI behavior
- `llms.txt` - AI-readable project index for coding assistants and doc ingestion

## Common Commands

```bash
bun ci
make setup             # create .env from .env.example
make validate          # check required env vars
make local             # run client and server directly
make start             # Docker Compose stack
make stop              # stop Docker Compose stack
bun run security:check # dependency audit plus supply-chain indicator scan
make kubernetes        # one-command CI + full local Kubernetes/Gateway deployment and test
make k8s-status        # Kubernetes status and URLs
make deploy-check      # Compose + Dockerfile + Helm/Kubernetes validation
make clean             # safe cleanup; preserve Docker volumes and Kubernetes PVCs
make k8s-destroy-data CONFIRM=chat-app # intentionally delete release PVCs
make clean-generated   # remove generated local artifacts
bun run check          # lint, typecheck, and tests
bun run test:e2e       # desktop and mobile journeys against the production build
bun run build:report    # production build plus enforced initial/total JS bundle budgets
bun run check:ci       # audit, supply-chain scan, knip, tests, builds, deployment checks
bun run k8s:validate   # alias for the deployment checker
docker compose config --quiet
```

The bundle report follows the Vite manifest's static imports and enforces an 800 KiB initial JavaScript budget, alongside the existing total and per-file budgets. Optional Markdown, code, math, and diagram renderers retain their asynchronous loading boundaries. `BUNDLE_MAX_INITIAL_JS_KIB` can override the initial budget for an explicitly reviewed change. `check:ci` runs the same budget check after building; browser journeys also check for uncaught browser errors and exercise rich answers.

Renderer styles are scanned from the client's workspace dependencies, matching Bun's isolated linker. KaTeX styles and fonts load with the math plugin, so equations render correctly without adding math assets to the initial page load.

Upgrade references: [Bun 1.4.2 release notes](https://bun.com/blog/bun-v1.4.2), [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0), and [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting).

## Generated Files

Some files are generated by local workflows and should not be edited by hand unless you know why:

- `client/src/routeTree.gen.ts`
- `helm/chat-app/values.local.yaml`
- `k8s/traefik-values.generated.yaml`
- workspace `dist/`, `.vite/`, `coverage/`, and `*.tsbuildinfo`

To remove only recreatable generated files:

```bash
make clean-generated
```
