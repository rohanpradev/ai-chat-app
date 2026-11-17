# MCP workspace

Open **Workspace → MCP workspace** (`/chat/mcp`) to discover connections, search tools/resources/prompts, inspect input schemas, read resources, preview parameterized prompts, and draft a chat using a selected capability. Discovery happens only after clicking **Discover capabilities**. Opening the page does not contact third-party servers. Discovery and previews can be cancelled; leaving a connection or capability aborts its pending read. Cancelled or superseded responses never replace the current view.

**Use in chat** preserves your entered prompt arguments in an editable draft. Select **Include this preview in the chat draft** to carry inspected context too. Drafts are scoped to your account and conversation, kept in memory, and cleared after leaving that conversation; they do not go into URLs or browser storage. Up to 12,000 preview characters are included with an explicit truncation notice. Nothing is sent to the model until you submit the draft.

In chat, enable **MCP**. The agent receives only the connections available to the authenticated user. It discovers capabilities on demand and asks for approval before each MCP discovery, tool call, resource read, or prompt retrieval. Approval shows the server, operation, capability, and arguments. Denial does not run the operation. Results retain remote error and truncation flags. The workspace preview API cannot execute tools.

## Configure connections

Set the server-side runtime secret `MCP_SERVERS` to a JSON array. Default `[]` disables all connections without changing existing chats. This example is illustrative; replace the endpoint, user ID, tool name, and credentials with values from a trusted server:

```json
[
  {
    "id": "team-docs",
    "name": "Team documentation",
    "description": "Find and explore our technical documentation",
    "url": "https://mcp.example.com/mcp",
    "headers": { "Authorization": "Bearer REPLACE_ME" },
    "userIds": ["REPLACE_WITH_AUTHENTICATED_USER_ID"],
    "allowedTools": ["search_docs"],
    "resources": true,
    "prompts": true
  }
]
```

Use compact single-line JSON in `.env`. Do not commit real values. `userIds` must be nonempty; unauthorized users cannot list, inspect, or use the connection. `allowedTools` defaults to empty and is enforced again during execution. Resource and prompt access default to false. All users explicitly assigned to a connection share its server credentials: provision separate entries/credentials where upstream data access differs.

Only operator-configured HTTPS destinations are accepted. URLs cannot contain credentials, query parameters, or fragments. HTTP redirects are rejected. Browser/model requests only identify configured connection IDs; they cannot supply endpoints or headers. Operators must choose trusted hosts and constrain outbound network access as appropriate. The app does not offer arbitrary URL registration, shell/stdio processes, or an OAuth sign-in flow. Use public servers or operator-provisioned authorization headers.

Set `AI_TOOL_APPROVAL_SECRET` to the same strong secret on every replica. Production startup requires it when MCP is configured. Keep it stable for approvals awaiting continuation.

Compose passes `MCP_SERVERS` from the environment. Helm supports `secrets.app.data.MCP_SERVERS` or the same key in `secrets.app.existingSecret`. Never put it in a client variable, ConfigMap, image build argument, or browser storage.

## Protocol and execution

The official `@ai-sdk/mcp` 2.x HTTP client negotiates the stable MCP **2026-07-28** protocol with legacy initialization fallback. The integration uses tools, listed resources, and prompts; it does not claim support for every MCP extension. Resource templates, OAuth account linking, interactive MCP Apps, elicitation, and background tasks are not exposed here.

Each operation owns and closes its client; no cross-user session or credential cache exists. Initialization and execution share a 20-second cancellation deadline. Tool calls have no automatic retries, avoiding accidental duplicate writes. Catalog pagination is followed with a limit of 100 entries per category and visible truncation. Remote tool inputs are validated against their advertised JSON Schema using Zod; schemas the validator cannot interpret fail closed. Tool output is bounded to 24,000 characters, binary payloads are omitted, and remote errors are sanitized.

Remote descriptions, prompts, resources, and output are untrusted data. No remote instructions are promoted to system instructions; preview content is escaped text. An MCP server's read-only/destructive annotations never override local approval requirements.

## API

All endpoints require an authenticated session and the AI rate limit:

- `GET /api/mcp/servers`: accessible connection summaries without credentials or endpoint URLs.
- `POST /api/mcp/inspect`: `{ "serverId": "team-docs" }`; live connection/protocol and allowed capabilities.
- `POST /api/mcp/preview`: `{ "serverId": "team-docs", "action": "read" | "prompt", "name": "...", "argumentsJson": "{}" }`.

Tool execution uses the existing signed chat approval flow, not a public execute endpoint. Saved messages use the stable `tool-mcp` contract, allowing older conversations to continue without storing remote schemas in the message type.

## Verification and rollout

Service tests cover access isolation, secret-free listings, allowed capabilities, argument validation, cancellation, cleanup, pagination, truncation, remote errors, and real SDK transport negotiation. Browser tests cover desktop/mobile discovery, filtering, previews, errors, empty states, and the chat handoff. Live provider behavior still needs a configured trusted MCP server and AI credentials.

Deploy with `MCP_SERVERS=[]`, verify existing chat, then add a restricted connection and test discovery, deny a proposed action, approve one known safe operation, and reload its saved conversation. Monitor sanitized MCP errors, timeouts, chat approvals, and API latency. Roll back a connection by removing it from configuration; pending calls recheck access. No database migration is needed. Older app versions may omit MCP message parts, so retain the newer app when existing MCP transcripts must stay visible.

## Official references

- [AI SDK MCP integration](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [MCP July 2026 specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
