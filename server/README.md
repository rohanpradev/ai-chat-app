# Server

Hono API for the chat app.

Use the root README for setup and deployment. Most commands are intended to run from the repository root.

## Development

```bash
bun ci
bun run --filter @chat-app/server dev
```

The API listens on `SERVER_PORT`, defaulting to `3000`.

## Build and Checks

```bash
bun run --filter @chat-app/server typecheck
bun run --filter @chat-app/server test
bun run --filter @chat-app/server build
```

## Database

Drizzle ORM and Kit are intentionally pinned to the same v1 release candidate. Config lives in `drizzle.config.ts`, and migration history uses Drizzle's v3 timestamped-folder format.

Common commands:

```bash
bun run --filter @chat-app/server db:generate
bun run --filter @chat-app/server db:migrate
```

Run the repository-level `bun run check:migrations` after schema changes. It validates the history and fails if generation would change committed migration output.

Kubernetes migrations use `server/Dockerfile.migrate` through the root Makefile.

## Notes

- Routes cover auth, profile, conversations, and AI streaming.
- Shared schemas and UI message validation come from `@chat-app/shared`.
- Langfuse telemetry initializes only when Langfuse credentials are configured.
- Production runtime packaging is handled by the repo root `Dockerfile`.
