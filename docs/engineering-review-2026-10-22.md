# Engineering review — October 22, 2026

The [Bun 1.4.4 follow-up](bun-upgrade-1.4.4.md) records the current runtime/dependency upgrade and repeated validation on October 23.

Starting revision: `97360fbdd00bf8e9cfefd0a828ec268c349a6c64`.

The review covered the React client, shared contracts, Hono routes, AI SDK streaming, approvals, conversation storage, quota accounting, uploads, dependencies, CI, container builds, and Kubernetes configuration. The client/server/shared boundaries and PostgreSQL schema remain intact. Rewrites target demonstrated failures at existing public interfaces.

## Findings and changes

| Finding | Resulting behavior | Regression evidence |
| --- | --- | --- |
| Two streams could overwrite each other's accepted turns; late completion could recreate a deleted chat | Writes compare an opaque snapshot under the existing PostgreSQL advisory lock. Deletion takes the same lock. Stale completion preserves the newer projection and settles usage | Concurrent real PostgreSQL writers and deletion races |
| Stale full histories could replace newer text or completed tool states | Stored messages remain authoritative. Only matching current pending approval decisions may update a stored assistant message | Public merge tests for stale text, roles, metadata, input/signature changes, repeated and obsolete approvals |
| Regeneration could remove a projection whose ID later collided with immutable revision 1 | Restored messages continue their immutable revision sequence; foreign or racing global ID claims reject atomically | Real PostgreSQL restoration and cross-user claim tests |
| Failed operations with billed tokens disappeared from quotas | Failed measured usage remains charged; repeated settlement preserves recorded consumption; unused reservations are released | Real PostgreSQL quota and repeated-settlement tests |
| The saved-chat query and router loader could restore old transcripts | SDK completion/error/Stop updates the cached transcript; route hydration blocks on the current loader snapshot | Real SDK hook tests and A → B → A browser journeys |
| Route reuse carried composer state and attachments into another chat | Conversation ID controls remounting, clearing drafts, files and tool selections | Desktop and mobile browser regressions |
| First prompts appeared in URLs, and prompts over 4,000 characters were discarded | User/conversation-scoped in-memory handoff keeps prompts out of new URLs and preserves longer input | Desktop and mobile long-prompt tests |
| Upload/provider/database failures were returned as raw 400 error messages | Explicit safe input errors return 400; unexpected failures return a generic 503. Batch vectors validate completely before storage | Route error-redaction and malformed-vector tests |
| PDF cleanup and Jev JSON arrays no longer matched upgraded APIs | PDF.js loading tasks are released; JSON arrays enter Jev as explicit JSON parts | Selectable PDF and Jev provider-seam tests, plus real Gateway checks |
| Vite 8.3.2 had six registry advisories | Compatible dependency updates and matching SDK/tooling packages remove the reported advisories | Online dependency audit, frozen install and production builds |
| DOM tests silently fell back to Bun where jsdom failed initialization | Node is explicit for client tests, with an LTS version and SHA-pinned CI setup | Complete client suite and browser suite |

See the [dependency review](dependency-upgrade-2026-10-22.md) for exact versions, primary references, and deliberately held major versions. [AI architecture](ai-architecture.md) records persistence, approval, and accounting semantics.

## Verification

The ordinary check runs lint, all workspace types, 31 client tests, and 122 server tests. Database cases are intentionally separate: `bun run test:integration` exercises 14 real PostgreSQL regressions and runs in its own CI job. The complete production-browser suite passed 32 desktop/mobile journeys. Screenshots were inspected for restored chat and mobile layout.

Both client/server production builds and the enforced bundle report passed. Initial JavaScript was 705.32 KiB against the 800 KiB limit. Frozen dependency installation, Knip, security/supply-chain checks, and migration consistency passed. No migration was generated.

Production client and server Docker images built successfully. The existing smoke scripts passed direct Nginx and Compose template startup, plus compiled server health/readiness as a non-root user with a read-only filesystem and no network. Deployment validation passed Compose parsing, Dockerfile checks, Helm lint, positive/negative chart rendering, and the configured Kubernetes-version matrix.

### Live model coverage

`bun run test:live` uses actual route handlers, session cookies, PostgreSQL, Redis, Vercel AI Gateway, and Serper. It uses unique synthetic accounts and documents, then removes those accounts and their cascading data. It prints assertions and operational metadata, excluding credentials and provider payloads. This suite is opt-in and makes billed model/search calls.

The default `openai/gpt-5-mini` run passed 23 checks: registration and session isolation; live model discovery; conversation creation/rename/ownership; streaming and saved history; regeneration; cancellation; structured planning and judging; Jev text and JSON-array evaluation; text/Markdown/PDF ingestion; model reading of a PDF attachment; database semantic search and tenant isolation; cited RAG; signed approval denial and acceptance; MCP access rejection; profile/cache updates; usage settlement; deletion and logout.

The same 23 checks also passed with `openai/gpt-6-astra`, selected from the live Gateway catalog. These synthetic checks establish feature compatibility, not a general model-quality ranking. The inexpensive default remains unchanged; the selector already exposes the Gateway's available language models. SDK warnings identify unsupported temperature settings on the tested reasoning models; Gateway ignores those settings and the asserted structured/RAG behaviors passed.

External MCP execution was skipped because no connection was configured for the disposable users. Existing deterministic service fixtures and browser tests cover MCP discovery, previews, cancellation, and chat handoff. A live connected-server run remains necessary in the target environment. GitHub OAuth and optional Sentry/Langfuse delivery also require their configured external environments; the local runs do not establish those integrations' production health.

To repeat against disposable, migrated services:

```sh
export LIVE_TEST_DB_URL='postgres://USER:PASSWORD@127.0.0.1:PORT/DISPOSABLE_DATABASE'
export LIVE_TEST_REDIS_URL='redis://127.0.0.1:PORT'
export LIVE_TEST_ALLOW_BILLING=1
bun run test:live
```

The server command loads the repo-root `.env` for `AI_GATEWAY_API_KEY` and optional `SERPER_API_KEY`. `LIVE_TEST_MODEL` selects another model from the live Gateway catalog. The suite uses isolated auth/approval secrets and disables external telemetry. It does not deploy the app or run migrations automatically.

## Rollout and rollback

Drain older API workers before enabling the new persistence behavior: old binaries do not enforce snapshot comparisons. Deploy the client and server together with the committed lockfile. No schema migration is required, and existing saved conversations remain readable. Watch conflicts, stream failures, upload failures and quota settlement after rollout. Roll back the application revision and dependency graph together; old code restores the former concurrency limitations.
