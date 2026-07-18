# Architecture and Ownership

Use this reference to place changes at the correct boundary and preserve application invariants.

## Source Map

| Concern | Primary source of truth | Typical consumers |
| --- | --- | --- |
| API schemas and cross-workspace contracts | `shared/schemas/`, `shared/types/`, `shared/api-contract.ts` | client and server |
| Model catalog | `shared/models.ts` | AI routes and model UI |
| Agent profiles | `shared/agents.ts`, `server/src/lib/agents.ts` | client agent selector and server execution |
| Tool IDs and public definitions | `shared/tool-ids.ts`, `shared/tools.ts` | client approval UI and server implementation |
| Tool implementation | `server/src/lib/tools.ts` | server agents |
| AI request boundary | `shared/schemas/chat.schema.ts`, `server/src/routes/ai/` | chat client and agent runtime |
| UI-message contract | `shared/schemas/ui-message.schema.ts`, `shared/types/ui-message.types.ts` | persistence, stream metadata, renderers |
| Conversation persistence | `server/src/services/conversation.service.ts`, `server/src/db/schema.ts` | conversation routes and AI stream completion |
| Auth | `server/src/lib/auth.ts`, `server/src/middlewares/auth-middleware.ts`, `client/src/lib/auth.tsx` | protected routes and session-aware UI |
| Client chat transport | `client/src/hooks/useAgentChat.ts`, `client/src/lib/chat-request.ts` | chat routes and components |
| Message rendering | `client/src/components/chat/MessagePart.tsx`, `ToolPartRenderer.tsx` | chat transcript |
| Environment parsing | `server/src/utils/env.ts`, `.env.example`, deployment values | server, Compose, Helm, CI |
| Deployment behavior | `Dockerfile`, `compose.yml`, `helm/chat-app/`, `k8s/`, `scripts/check-deployments.mjs` | local and production runtime |

Read the owning file plus its nearest tests before editing. Search for every export consumer before changing a shared symbol.

## Boundary Rules

### Shared TypeScript

- Keep cross-boundary Zod schemas, inferred types, model metadata, agent metadata, and tool identifiers in `shared/`.
- Export shared modules explicitly from `shared/package.json` and the appropriate barrel.
- Keep `shared/` runtime-neutral. Exclude database clients, provider SDKs, secrets, Node-only or Bun-only APIs, and client framework state.
- Prefer type-only imports and erasable TypeScript. Avoid runtime enums and namespaces without a concrete runtime need.
- Treat type failures as boundary-design feedback. Repair the contract instead of casting around it.

### React client

- Store remote state in TanStack Query and route state in TanStack Router loaders or validated search parameters.
- Keep chat state as typed AI SDK `UIMessage` parts. Render every supported part explicitly; do not collapse messages into a single text field.
- Keep request shaping in `prepareSendMessagesRequest`, metadata validation in `messageMetadataSchema`, and approval continuation in `lastAssistantMessageIsCompleteWithApprovalResponses`.
- Preserve reversible optimistic behavior, keyboard navigation, focus visibility, labels, loading states, empty states, errors, and reduced-motion behavior.
- Use local UI primitives and existing icons before adding a dependency. Lazy-load heavy renderers and media tooling.
- Start independent I/O together and await it only where needed. Check loaders, query functions, and component boundaries for serial waterfalls before micro-optimizing render code.
- Derive state during render when possible, keep effect dependencies honest, and move user-interaction logic into event handlers. Use `useEffectEvent` for event-like logic called from effects, not to suppress dependencies.
- Split heavy or rarely used UI on an observable boundary and use `bun run build:report` to prove a bundle improvement. Do not replace intentional shared-package exports with scattered deep imports without measurement.
- Use the TanStack Router skills bundled in installed dependencies when router behavior is the task; read only the relevant router sub-skill.

### Hono server

- Keep route definition, handler, tests, and OpenAPI schema together by feature.
- Validate input at the route boundary with shared schemas.
- Derive identity, permissions, and tenancy from authenticated server state, never model output or client-supplied IDs alone.
- Use explicit transactions for multi-write invariants and safe client errors for failures.
- Keep provider-specific behavior behind server modules.

### Data and persistence

- Keep `server/src/db/schema.ts`, generated Drizzle migrations, runtime assumptions, and deployment migration commands aligned.
- Preserve conversation projections and immutable message revision history. Account for regenerate, resume, retry, deletion, and concurrent replicas.
- Preserve per-conversation PostgreSQL advisory locking when writes could interleave.
- Design schema rollouts for old-code/new-code overlap. Separate expand, migrate, and contract phases when one deployment cannot be safely rolled back.
- Never hand-edit an already-applied migration as routine cleanup.

## Generated and Derived Files

Use the owning generator. Do not hand-edit:

- `client/src/routeTree.gen.ts`
- `server/src/db/drizzle/` migration output, except when intentionally reviewing and correcting a newly generated migration before application
- `helm/chat-app/values.local.yaml`
- `k8s/traefik-values.generated.yaml`
- `dist/`, `.vite/`, `coverage/`, and `*.tsbuildinfo`

Inspect generated diffs before handoff. Unexpected output is a failing signal, not incidental noise.

## Domain Language and Decisions

Read `CONTEXT-MAP.md`, `CONTEXT.md`, and nearby ADRs if they exist. Challenge overloaded terms against the glossary and update the glossary when a durable domain term is resolved.

Record an ADR only when a decision is hard to reverse, surprising without context, and selected from real alternatives. Include consequences, validation, and rollback notes.
