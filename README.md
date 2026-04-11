# Chat App

Production-minded AI chat application built with Bun, React, Hono, PostgreSQL, Redis, and the AI SDK.

This repository is intentionally broader than a chat demo. It covers the parts that usually get skipped in prototypes: typed contracts between client and server, approval-gated tool usage, persistent conversations, observability, and two realistic deployment paths for local infrastructure.

![Biome](https://img.shields.io/badge/biome-%2360A5FA.svg?style=for-the-badge&logo=biome&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Helm](https://img.shields.io/badge/helm-%230F1689.svg?style=for-the-badge&logo=helm&logoColor=white)
![Hono](https://img.shields.io/badge/hono-%23E36002.svg?style=for-the-badge&logo=hono&logoColor=white)
![Nginx](https://img.shields.io/badge/nginx-%23009639.svg?style=for-the-badge&logo=nginx&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![TraefikProxy](https://img.shields.io/badge/Traefik-%252300314b.svg?style=for-the-badge&logo=traefikproxy&logoColor=white)
![Zod](https://img.shields.io/badge/zod-%233068b7.svg?style=for-the-badge&logo=zod&logoColor=white)

## Why This Repo Exists

- It shows how to ship an AI feature as part of a complete product, not as an isolated prompt box.
- It keeps the frontend, API, shared schemas, and deployment tooling aligned through one codebase.
- It treats tool usage as a UX and safety problem, not only an SDK integration problem.
- It keeps the local story strong: Docker for the fastest end-to-end loop, Kubernetes for a more production-shaped deployment.

## What It Does

- Streams assistant responses in real time with the AI SDK.
- Supports multiple OpenAI models, with `gpt-5-mini` as the default and `gpt-4.1-mini`, `gpt-4o-mini`, and `gpt-4o` also available.
- Persists conversations and message parts in PostgreSQL.
- Uses JWT cookie auth for registration, login, logout, and current-user checks.
- Adds approval-gated live web search through Serper, rendered inline in the chat UI.
- Handles attachments in chat input, including images, PDFs, and common text/code file types.
- Streams reasoning and sources into the interface when the provider returns them.
- Emits telemetry to Langfuse Cloud when keys are configured.
- Runs cleanly through Docker Compose or a Helm-based Kubernetes workflow.

## Product Highlights

- Human-in-the-loop tool execution. Web search is not fire-and-forget. The server marks the tool as approval-required, the UI surfaces an explicit approval state, and the conversation resumes automatically after the response.
- Typed boundaries across the stack. The `shared/` workspace carries schemas, model metadata, tool definitions, and UI message validation so the client and server are not freehanding payloads.
- Persistent chat state. Conversations are owned per user, stored in PostgreSQL, and restored back into validated UI messages when a thread is reopened.
- Deployment parity where it matters. The same app can run behind Traefik locally in Docker or behind a Traefik Gateway setup in Kubernetes, with the repo-root `.env` remaining the source of truth.
- Observability that matches the product. Langfuse is wired into the streaming server path, so model choice, tool usage, and session-level telemetry are part of the default story rather than a later add-on.

## Architecture

```text
Browser
  -> Traefik
  -> React client
  -> Hono API on Bun
  -> PostgreSQL
  -> Redis
  -> OpenAI
  -> Serper
  -> Langfuse Cloud
```

Runtime notes:

- In Docker, Traefik terminates TLS and routes to the client container and API container.
- In Kubernetes gateway mode, Traefik is installed through Helm and routes hostname-based traffic to the app Helm release.
- The `shared/` package is the contract layer used by both the React app and the API.

## Stack

- Frontend: React 19, TanStack Router, TanStack Query, Vite, Tailwind CSS, AI Elements-inspired UI primitives
- Backend: Hono, Bun, Drizzle ORM, Zod, OpenAPI generation
- AI: OpenAI via the AI SDK, streaming UI messages, approval-aware tool calls
- Data: PostgreSQL for persistence, Redis for cache/runtime support
- Observability: Langfuse Cloud via OpenTelemetry exporter
- Infra: Docker Compose, Helm, Kubernetes Gateway API, Traefik

## Repository Layout

```text
client/                 React application
server/                 Hono API, routes, middleware, DB access
shared/                 Shared schemas, models, tool definitions, UI message types
helm/chat-app/          Helm chart for the application
scripts/                Deployment, migration, and env sync helpers
compose.yml             Local Docker stack
Makefile                Common workflows for local, Docker, and Kubernetes
```

## Key Implementation Areas

### Frontend

- Chat interface built around `useChat`, with approval-aware resume behavior.
- Conversation sidebar with thread creation and navigation.
- Attachment-capable prompt input with model selection and web-search toggle.
- Message rendering that understands text, attachments, reasoning, sources, and tool states.

### Backend

- Hono routes for auth, profile, conversations, and AI streaming.
- Shared request and response validation via Zod.
- Streaming route built on `streamText(...)` with telemetry, source streaming, and message persistence on completion.
- Approval-gated Serper integration normalized into a stable UI/message shape.

### Data Model

- `users` for identity and profile data.
- `chat` for conversation ownership and metadata.
- `message` for ordered persisted message parts per conversation.

### Contracts

- Shared model catalog exposed to the client for model selection.
- Shared tool definitions reused for UI message validation and server execution.
- Shared route payload types used by the client API layer.

## Quick Start

### Prerequisites

- Bun `1.3.12+`
- Docker Desktop or OrbStack
- Kubernetes tooling only if you want the Helm flow: `kubectl` and `helm`

### First-Time Setup

```bash
make setup
```

Then edit `.env`.

Required values:

- `OPENAI_API_KEY`
- `JWT_SECRET`
- `DB_PASSWORD`

Useful optional values:

- `SERPER_API_KEY` for live web search
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` which defaults to `https://cloud.langfuse.com`

Validate before starting:

```bash
make validate
```

## Docker Workflow

Start the full local stack:

```bash
make start
```

This brings up:

- Traefik
- PostgreSQL
- Redis
- migration job
- API server
- client application

Useful URLs:

- App: `https://localhost`
- API health: `https://localhost/health`
- Traefik dashboard: `http://localhost:8080/dashboard/`
- Langfuse Cloud: `https://cloud.langfuse.com`

Notes:

- Local Docker uses Docker Hardened Images for Traefik.
- Traefik health uses `traefik healthcheck --ping`, which works with the hardened runtime image.
- Langfuse is hosted, not self-hosted inside this stack.
- To fully stop local Docker and Kubernetes resources and free machine capacity, run `make shutdown-all`.

## Local Workspace Development

If you want to run the workspaces directly:

```bash
bun install --frozen-lockfile
make local
```

Recommended checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Or run the combined quality gate:

```bash
bun run check
```

If you want to reset only recreatable workspace artifacts without touching environment files:

```bash
make clean-generated
```

This removes local build outputs and generated files such as:

- root and workspace `node_modules/`
- workspace `dist/`, `coverage/`, `.vite/`, and `*.tsbuildinfo`
- generated files like `client/src/routeTree.gen.ts`
- generated Helm and Traefik local values files

It does not remove `.env`, `.env.local`, or lockfiles.

## Kubernetes Workflow

The Kubernetes path is driven by the Helm chart in `helm/chat-app`.

There are two practical local modes.

### 1. App-Only Mode

This is the fastest Kubernetes path if you only want the app running.

```bash
make kubernetes
```

Local URLs:

- App: `http://localhost:30080`
- API: `http://localhost:30001`
- Health: `http://localhost:30001/health`

### 2. Gateway Mode

This is the more production-shaped setup for local Kubernetes.

```bash
# set K8S_GATEWAY_ENABLED=true in .env first
make k8s-full-stack
```

This installs:

- Traefik in namespace `traefik`
- the chat app in namespace `default`

Gateway URLs:

- App: `https://app.docker.localhost:30001`
- Health: `https://app.docker.localhost:30001/health`
- Traefik dashboard: `https://traefik.docker.localhost:30001`

Important details:

- `helm/chat-app/values.local.yaml` is generated from the repo-root `.env`.
- In gateway mode, the app services switch to `ClusterIP` and Traefik owns TLS termination and hostname routing.
- Database migration is run explicitly as part of the Kubernetes workflow.

## AI, Tools, and Observability

### Models

Current model catalog:

- `gpt-5-mini`
- `gpt-4.1-mini`
- `gpt-4o-mini`
- `gpt-4o`

### Tooling

The production tool exposed to requests is:

- `serper` for live web search

Behavior:

- The tool is approval-gated.
- The client requests it only when web search is enabled.
- Results are normalized server-side and rendered as structured cards in the chat UI.
- Tool approval state is persisted through the AI SDK UI message flow.

### Langfuse

The server initializes telemetry only when Langfuse credentials are present.

Set these in `.env`:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL=https://cloud.langfuse.com`

Scope:

- Langfuse covers model and tool telemetry for the app.
- Container and cluster logs still come from `docker compose logs` and `kubectl logs`.

## API Surface

The API is mounted under `/${BASE_API_SLUG}`.

Main areas:

- Auth: register, login, logout, current user
- Profile
- Conversations: create, list, fetch, rename
- AI streaming: `/ai/text-stream`

The server also generates OpenAPI metadata for documented routes and ships a Scalar reference configuration in the API layer.

## Quality and Maintenance

The repo already includes tests around:

- auth flows
- AI route behavior
- tool normalization and execution
- Redis cache middleware
- prompt/message transformation utilities

Commands worth keeping in your normal loop:

- `bun run check`
- `bun run test`
- `make clean-generated`
- `make status`
- `make k8s-status`

Cleanup command reference:

- `make clean-generated` removes recreatable workspace artifacts and generated files, but keeps `.env` files.
- `make clean` removes Docker Compose containers, networks, volumes, and local images.
- `make shutdown-all` tears down local Docker and Kubernetes infrastructure.

## Why It Reads Like a Product, Not a Sample

This codebase has a real boundary between UI, API, shared contracts, infrastructure, and observability. That is the main reason it holds up as a flagship project: the interesting work is not only in generating text, but in making the surrounding system typed, inspectable, deployable, and safe to operate.
