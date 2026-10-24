# Dependency follow-up — October 23, 2026

This refresh continues the [October 22 audit](dependency-upgrade-2026-10-22.md) and the user's explicit request for [Bun 1.4.4](bun-upgrade-1.4.4.md). Versions were selected from registry publication metadata with the existing three-day gate, including Bun's additional stability filtering.

| Package | Prior reviewed version | Selected version |
| --- | --- | --- |
| Bun runtime, package-manager pin and types | 1.4.3 | 1.4.4 |
| `ai` | 7.0.143 | 7.0.146 |
| `@ai-sdk/react` | 4.0.147 | 4.0.150 |
| `@ai-sdk/mcp` | 2.0.78 | 2.0.80 |
| `@ai-sdk/otel` | 1.0.143 | 1.0.146 |
| `@ai-sdk/provider-utils` override | 5.0.62 | 5.0.64 |
| `@tanstack/react-query` | 5.104.1 | 5.104.5 |
| `lucide-react` | 1.59.0 | 1.60.0 |
| `knip` | 6.42.0 | 6.42.1 |

The lockfile contains the full direct/transitive graph. The [AI SDK](https://raw.githubusercontent.com/vercel/ai/main/packages/ai/CHANGELOG.md), [React integration](https://raw.githubusercontent.com/vercel/ai/main/packages/react/CHANGELOG.md), [MCP](https://raw.githubusercontent.com/vercel/ai/main/packages/mcp/CHANGELOG.md), and [provider utility](https://raw.githubusercontent.com/vercel/ai/main/packages/provider-utils/CHANGELOG.md) changelogs were reviewed together. Relevant changes cover reasoning-message handling, integration types, OAuth server binding, and backing-buffer retention. [Query 5.104.5](https://github.com/TanStack/query/releases/tag/@tanstack%2Freact-query@5.104.5) addresses mutation selector/filter recomputation; [Lucide 1.60.0](https://github.com/lucide-icons/lucide/releases/tag/1.60.0) updates its icon catalog.

Only `@types/bun@1.4.4` and `bun-types@1.4.4` bypass the release-age hold, matching the explicitly requested runtime. The readable `minimumReleaseAge = "3d"` preserves the former 259,200-second policy. Future Bun type versions and other packages remain gated. Better Auth 1.7.11 and Motion 14.4.0 were held by Bun's stability filter; no global bypass or unsupported major upgrade was used. The earlier Langfuse, Babel, Mermaid, and KaTeX major-version decisions still apply.

`bun ci --no-env-file` passed without changes after resolution. No new package owners or trust permissions were introduced. `protobufjs@7.6.6` retains a blocked postinstall script; it was not granted execution to make the installation appear cleaner. Builds and runtime checks determine whether an install is usable. The online audit reported no vulnerabilities among 866 packages, and the known supply-chain indicator scan passed.

Final application, browser, database, container, live-model, and infrastructure evidence is recorded in the [Bun 1.4.4 upgrade review](bun-upgrade-1.4.4.md).
