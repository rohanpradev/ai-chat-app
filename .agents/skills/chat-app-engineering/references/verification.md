# Verification Matrix

Select checks from the changed risk surface. Run narrow feedback loops during implementation, then the broadest practical relevant check before handoff.

## Core Commands

Run from the repository root unless noted:

| Purpose | Command |
| --- | --- |
| Install exactly from lockfile | `bun ci` |
| Lint and formatting check | `bun run lint` |
| Type boundaries | `bun run typecheck` |
| Unit and integration tests | `bun run test` |
| Client and server production builds | `bun run build` |
| Core pre-handoff check | `bun run check` |
| Dead exports and dependency usage | `bun run knip` |
| Dependency and supply-chain checks | `bun run security:check` |
| Compose, Docker-when-available, Helm, and Kubernetes validation | `bun run check:deploy` |
| Full CI-equivalent local suite | `bun run check:ci` |
| Browser journeys | `bun run test:e2e` |
| Client bundle report | `bun run build:report` |

Prefer `bun run check` for ordinary code changes. Add the specialized checks below when their surface changes. Use `bun run check:ci` when risk and available local dependencies justify the full suite.

## Narrow Loops

### Client

- Run one Vitest file: `cd client && bunx --no-install vitest run <test-file>`.
- Run the client suite: `bun run --filter @chat-app/client test`.
- Type-check the client: `bun run --filter @chat-app/client typecheck`.
- Build after route, bundling, environment, lazy-loading, or dependency changes: `bun run build:client`.
- Use browser evidence for interactive behavior; component tests alone do not prove routing, network, streaming, focus, or visual state.

### Server

- Run one Bun test file with the required environment preload: `cd server && bun test --preload ./src/test/setup-env.ts <test-file>`.
- Run the server suite: `bun run --filter @chat-app/server test`.
- Type-check the server: `bun run --filter @chat-app/server typecheck`.
- Build after entrypoint, dependency, runtime, instrumentation, or package-boundary changes: `bun run build:server`.

### Shared contracts

- Run the shared type check: `bun run --filter @chat-app/shared typecheck`.
- Then type-check and test both client and server consumers.
- For request, response, tool, model, agent, or UI-message shape changes, add boundary tests on both producer and consumer sides.

### Database

Run migration generation using a disposable or CI-style database URL, then inspect the result:

```bash
cd server
DB_URL=postgres://postgres:postgres@localhost:5432/chatapp bun run db:generate
git diff -- src/db/drizzle
```

An empty diff is expected when schema code did not intentionally change. For a new migration, inspect SQL, metadata, rollout compatibility, and rollback rather than expecting an empty diff.

### AI and streaming

- Run `server/src/lib/agent-message-normalizer.test.ts`, `server/src/lib/tools.test.ts`, route tests under `server/src/routes/ai/`, and `client/src/lib/chat-request.test.ts` when their seams change.
- Add stream-part, approval-state, abort, timeout, and saved-conversation cases as relevant.
- Run the eval fixture set described in `docs/evals.md`; record baseline and candidate results for behavior changes.
- Exercise the real browser flow for visible streaming or approval UI changes.

### Docker and deployment

- Validate Compose source with `docker compose config --quiet` when Docker is available.
- Run `bun run check:deploy` for Dockerfile, Compose, Helm, Kubernetes, deployment scripts, environment, ports, probes, images, or command changes.
- Render and inspect the affected manifests, not just the source templates.
- Use `make health` or the relevant smoke route after starting the stack when runtime behavior changes.

### Documentation and configuration

- Check every documented command and path against current scripts and source.
- Run the closest parser, render, or build even when no application code changed.
- Search for old names, ports, environment variables, and paths after renames.

## Proof Ledger

Before handoff, capture:

```text
Acceptance behavior:
Fixed point reviewed:
Commands run:
Observed results:
Generated or migration diff:
Checks not run and blocker:
Remaining risk / rollout signal / rollback:
```

Do not claim a command passed from truncated output, a skipped suite, an unrelated green test, or a static check that never exercised the changed behavior.

