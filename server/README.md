# Server

Hono API for the chat app.

Use the root README for setup and deployment. Most commands are intended to run from the repository root.

## Development

```bash
bun install --frozen-lockfile
bun run --filter @chat-app/server dev
```

The API listens on `SERVER_PORT`, defaulting to `3000`.

## Build and Checks

```bash
bun run --filter @chat-app/server typecheck
bun run --filter @chat-app/server test
```

## Database

Drizzle config lives in `drizzle.config.ts`.

Common commands:

```bash
bun run --filter @chat-app/server db:generate
bun run --filter @chat-app/server db:migrate
```

Kubernetes migrations use `server/Dockerfile.migrate` through the root Makefile.

## Notes

- Routes cover auth, profile, conversations, and AI streaming.
- Shared schemas and UI message validation come from `@chat-app/shared`.
- Langfuse telemetry initializes only when Langfuse credentials are configured.
- Production runtime packaging is handled by the repo root `Dockerfile`.
