# Chat App

Full-stack AI chat application with a React client, Hono API, PostgreSQL, Redis, and OpenAI-backed chat.

## Stack

- Client: React 19, TanStack Router, Vite
- Server: Hono, Bun, Drizzle ORM
- Data: PostgreSQL, Redis
- AI: OpenAI
- Docker runtime: Traefik at the edge, Nginx inside the client container
- Kubernetes: Helm chart in `helm/chat-app`

## Repo Layout

```text
client/                 React app
server/                 Hono API and DB schema
shared/                 Shared schemas and types
compose.yml             Docker Compose stack
helm/chat-app/          Helm chart
scripts/                Deployment and env sync scripts
Makefile                Common dev, Docker, and Kubernetes commands
```

## Environment

The repo-root `.env` is the source of truth for local Docker and local Kubernetes secrets.

Important values:

- `OPENAI_API_KEY`
- `JWT_SECRET`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `CLIENT_URL`
- `BASE_API_SLUG`

Optional observability/tooling values:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASEURL`
- `SERPER_API_KEY`

## Docker Compose

Compose uses both Traefik and Nginx, but they do different jobs:

- Traefik is the external reverse proxy and TLS entrypoint.
- Nginx runs inside the client image and serves the built frontend bundle.

Request flow:

```text
browser -> Traefik -> client Nginx -> server
browser -> Traefik -> server          (/api)
```

Start:

```bash
make start
```

Stop:

```bash
make stop
```

Useful Compose URLs:

- App: `https://localhost`
- API health: `https://localhost/health`
- Traefik dashboard: `http://localhost:8080/dashboard/`
- Langfuse: `https://langfuse.localhost`

## Local Development

Run the client and server directly:

```bash
make local
```

## Kubernetes

The Kubernetes path is driven by the Helm chart in `helm/chat-app`.

Key details:

- local override file: `helm/chat-app/values.local.yaml`
- that file is generated from the repo-root `.env` by `scripts/ensure-k8s-secrets.sh`
- local Kubernetes migration is run explicitly with `make k8s-migrate`
- the migration job is single-sourced from `helm/chat-app/templates/migration-job.yaml`

Main commands:

```bash
make kubernetes      # build, deploy, migrate, smoke test, print URLs
make k8s-build       # build app images
make k8s-deploy      # helm upgrade/install
make k8s-migrate     # run DB migration job
make k8s-status      # show resources and URLs
make k8s-logs        # tail logs
make k8s-cleanup     # uninstall helm release
```

Local Kubernetes URLs:

- App: `http://localhost:30080`
- API: `http://localhost:30001`
- Health: `http://localhost:30001/health`

Important:

- The app API is mounted under `/${BASE_API_SLUG}`.
- With the current local chart override, the usable auth route is `POST /api/auth/register`.
- The Traefik hostname route `https://app.docker.localhost` is not available unless a Gateway API + Traefik controller is installed in the cluster.

## Database

Schema lives in:

- `server/src/db/schema.ts`

Migration image:

- `server/Dockerfile.migrate`

Drizzle config:

- `server/drizzle.config.ts`

## Tested Flow

The working local Kubernetes flow is:

1. build images
2. deploy Helm release
3. run migration job
4. verify `/health`
5. verify auth routes under `/api`

The migration step is required. Without it, registration fails because the `users` table does not exist.

## Notes

- OpenAI is the AI provider used for this project.
- Azure-related fields may still exist in chart/env plumbing, but the README and expected local setup assume OpenAI-first usage.
