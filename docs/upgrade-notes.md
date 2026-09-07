# September 2026 upgrade verification

This pass builds on the existing Bun 1.4.2 upgrade and keeps the app on the stable AI SDK 7 release line. The resolved SDK versions are `ai` 7.0.91, React integration 4.0.94, OpenAI provider 4.0.57, and OpenTelemetry integration 1.0.91. Updates retain Bun's 72-hour release-age policy and the frozen workspace lockfile.

## Observable improvements

- Accepted prompts are saved before model preparation. A preparation failure preserves the prompt, and a persistence failure releases reserved quota without contacting the provider.
- Initial JavaScript falls from 1,214,087 bytes to approximately 757,000 bytes, a 38% reduction. Optional renderers and syntax grammars keep their asynchronous loading boundaries. An 800 KiB initial JavaScript budget is enforced locally and in CI, in addition to the existing total and per-file budgets.
- Streamdown styles resolve through the client workspace's isolated dependencies. KaTeX styles load with the math plugin, fixing duplicated and unformatted equations. Production browser checks cover code, math, diagrams, mobile overflow, and uncaught errors.
- CI uses verified multi-platform Bun and Nginx image digests. Nginx's template directory has traversal permission for the non-root runtime user, fixing a startup path that otherwise silently omitted the app configuration.
- CI probes the compiled server's health and readiness in an isolated, read-only container, in addition to checking both Nginx configuration modes.

## Verification

- `bun ci`: frozen install passes without lockfile changes.
- `bun run check:ci`: audit, supply-chain scan, Knip, migration checks, lint, types, 18 client tests, 77 server tests, production builds, bundle budgets, Dockerfile checks, Compose validation, and Helm renders pass.
- `bun run test:e2e`: all 12 production desktop/mobile browser journeys pass; rich-message screenshots inspected.
- The new persistence regressions and missing-math-styles check failed before their fixes and passed afterward. The initial bundle budget was also verified to fail with a deliberately insufficient limit.
- Client, server, and migration Docker images build. Both Nginx startup modes and the server health/readiness smoke check pass under non-root, read-only runtime constraints.
- Database migrations and generated route definitions are unchanged.

No live model-quality evaluation or deployment was performed. The default model, prompts, tool definitions, and database schema are unchanged. Container health checks do not prove database, Redis, or provider connectivity, and local validation does not claim a hosted GitHub Actions run.

## Rollout

Build and deploy client/server images together through the existing release process. No new database migration is required. Saving the prompt adds one database transaction before generation; watch persistence latency, failed usage settlements, and browser asset errors. Roll back the application images if those signals regress; stored message formats remain compatible.

## Primary references

- [Bun 1.4.2 release notes](https://bun.com/blog/bun-v1.4.2)
- [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- [AI SDK message persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting)
