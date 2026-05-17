# Security Hardening

## Runtime Controls

- Auth is Better Auth session-cookie based. Production cookies are `httpOnly` and `secure`.
- `BETTER_AUTH_SECRET` must be at least 32 characters and should be randomly generated.
- Production startup rejects `CORS_ORIGINS=*` because credentialed cookies are enabled.
- Better Auth provides auth endpoint protections. Traefik still provides the outer production rate limit.
- Request bodies are capped globally, and embedding uploads have a tighter route-level cap.
- Sentry defaults avoid sending PII unless `SENTRY_SEND_DEFAULT_PII=true` is explicitly configured.

## Proxy Controls

Nginx serves the client with:

- `server_tokens off`
- hidden-file denial
- no-cache HTML shell
- immutable cache for fingerprinted assets
- SSE proxy buffering disabled for AI streams
- security headers on static, HTML, API, and streaming paths

Traefik provides:

- HTTPS routing
- app and API rate limits
- compression excluding `text/event-stream`
- security headers and CORS controls
- dashboard exposure restricted by local/private IP allowlist

## Container and Kubernetes Controls

- Client, server, and migration containers run as non-root users.
- App containers disable privilege escalation, drop Linux capabilities, and use read-only root filesystems.
- Kubernetes workloads disable service account token automounting.
- Network policies default deny traffic and explicitly allow only app, database, Redis, DNS, gateway, and server internet egress.
- Server internet egress is required for OpenAI, Serper, Langfuse, Sentry, and provider APIs.

## Production Checklist

- Use strong unique values for `BETTER_AUTH_SECRET`, `DB_PASSWORD`, and `REDIS_AUTH`.
- Keep `CORS_ORIGINS` explicit. Do not use `*` in production.
- Enable GitHub secret scanning and push protection.
- Enable Dependabot alerts and review dependency PRs manually.
- Use image digests for production base images when possible.
- Run `bun run security:check`, `bun run check`, Docker validation, and Helm validation before release.
- Keep API keys in runtime secrets only; never use `VITE_` variables for private server credentials.
