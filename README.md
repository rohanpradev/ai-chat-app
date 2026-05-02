# Chat App

AI chat application built with Bun, React, Hono, PostgreSQL, Redis, and the AI SDK.

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

The repo is a Bun workspace with three app packages:

- `client/` - React app
- `server/` - Hono API
- `shared/` - shared schemas, model metadata, tool definitions, and UI message types

It can run locally with Docker Compose or through the Helm chart under `helm/chat-app/`.

## Features

- Streaming chat responses through the AI SDK
- Cookie-based auth for register, login, logout, and current user
- Persistent conversations in PostgreSQL
- Redis-backed runtime/cache support
- Shared Zod schemas and TypeScript types across client and server
- Approval-gated web search with Serper
- File attachments in chat input
- Mermaid rendering loaded lazily for markdown diagrams
- Optional Langfuse telemetry through OpenTelemetry
- Docker Compose and local Kubernetes workflows

## Stack

- Runtime/package manager: Bun
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
```

## Prerequisites

- Bun `1.3.12+`
- Docker Desktop or OrbStack
- `kubectl` and `helm` for Kubernetes
- OpenAI API key

Optional:

- Serper API key for web search
- Langfuse keys for telemetry

## Setup

Create a local `.env`:

```bash
make setup
```

Then edit `.env`. At minimum set:

```text
OPENAI_API_KEY=
JWT_SECRET=
DB_PASSWORD=
```

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
bun install --frozen-lockfile
```

Run client and server directly:

```bash
make local
```

Default local URLs:

- Client: `http://localhost:5173`
- Server: `http://localhost:3000`

Useful checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Or run the combined check:

```bash
bun run check
```

## Docker

Start the full local stack:

```bash
make start
```

This starts Traefik, PostgreSQL, Redis, the migration job, API server, and client.

URLs:

- App: `https://localhost`
- API health: `https://localhost/health`
- Langfuse Cloud: `https://cloud.langfuse.com`

Stop the stack:

```bash
make stop
```

Remove Compose containers, volumes, and local images:

```bash
make clean
```

## Kubernetes

The Kubernetes flow uses Helm and values generated from the repo-root `.env`.

For the full local Gateway setup with Traefik:

```bash
# K8S_GATEWAY_ENABLED=true in .env
make k8s-full-stack
```

This will:

1. Install or upgrade Traefik
2. Generate local Helm values
3. Build the server, client, and migration images
4. Deploy the app chart
5. Run database migrations
6. Run a smoke test
7. Print status and URLs

Gateway URLs:

- App: `https://app.docker.localhost:30001`
- Health: `https://app.docker.localhost:30001/health`
- Traefik dashboard: `https://traefik.docker.localhost:30001`

Check status:

```bash
make k8s-status
```

Show logs:

```bash
make k8s-logs
```

Remove the app release:

```bash
make k8s-cleanup
```

Stop local infrastructure more broadly:

```bash
make shutdown-all
```

## Bun Workspaces

Dependency versions shared across workspaces are defined in the root `catalog` field and referenced with `catalog:` from package manifests.

The repo uses Bun's isolated linker:

```toml
[install]
linker = "isolated"
```

This matters for Docker. The production images copy:

- root `node_modules`, which contains Bun's `.bun` package store
- workspace `node_modules`, which contain the package-local dependency links

Without both parts, imports from `/app/server` or `/app/shared` can fail at runtime.

## AI and Tools

The server uses the AI SDK for streaming responses. The model catalog lives in `shared/models.ts`.

Web search is exposed through the `serper` tool. It is approval-gated, so the UI must explicitly approve a tool call before the server continues the stream.

Langfuse telemetry is initialized only when credentials are present. AI SDK telemetry is enabled on server-side model calls and is exported through Langfuse's OpenTelemetry span processor.

## Common Commands

```bash
make setup             # create .env from .env.example
make validate          # check required env vars
make local             # run client and server directly
make start             # Docker Compose stack
make stop              # stop Docker Compose stack
make k8s-full-stack    # full local Kubernetes + Traefik run
make k8s-status        # Kubernetes status and URLs
make clean-generated   # remove generated local artifacts
bun run check          # lint, typecheck, and tests
```

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
