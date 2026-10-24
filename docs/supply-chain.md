# Dependency maintenance

Use Bun workspaces, the root dependency catalog, and the committed `bun.lock`. CI and production installs use `bun ci` to reject manifest/lockfile drift. The 72-hour minimum release age in `bunfig.toml` applies to fresh dependency resolution; preserve it during routine upgrades.

The runtime baseline is Bun 1.4.4. Keep the package-manager pin, runtime engines, Bun type packages, Docker defaults, Compose defaults, environment examples, and both CI workflows aligned. Verify the multi-platform Docker digest when changing CI's Bun image. The [Bun upgrade audit](bun-upgrade-1.4.4.md) records feature decisions and rollout checks. Native checks are the default; `bun run typecheck:tsc` retains TypeScript 7.0.2 for comparison.

For a refresh, run `bun outdated --filter '*'`, review upstream release notes, and use `bun update --recursive` for compatible releases. Review major releases separately before using `--latest`. Review root overrides separately: updating direct dependencies does not refresh those pins. Keep overrides within the parent package's supported range unless a reviewed migration and runtime checks cover the change.

The [October 23 dependency review](dependency-upgrade-2026-10-23.md) records the current versions, security baseline, official references, and intentionally deferred major upgrades. Babel 7, Mermaid 11, and KaTeX 0.18 remain aligned with their consumers. The KaTeX 0.18.11 override keeps renderers and the lazy-loaded stylesheet on the same release. AI SDK 7.0.146 and its React/MCP packages use the matching provider utilities 5.0.64. Sentry's Vite plugin now releases with its SDK and shares version 11.8.0.

Client test scripts invoke Node explicitly; `.nvmrc` and CI select security-patched Node 24.22.1 LTS. Bun 1.4.4 also passes the real-SDK hook suite with jsdom, fixing the startup failure observed on 1.4.3. Node remains development tooling; application execution, server tests, installs, server builds, and native type checks remain on Bun.

Before shipping, run `bun run security:check`, `bun run check`, `bun run knip`, `bun run check:migrations`, `bun run build:report`, and `bun run test:e2e`. Review new package owners, lifecycle scripts, binary downloads, and unexpected workflow or generated-file changes. `bun run check:ci` also validates deployment configuration; it requires the relevant local deployment tools.

`security:check` combines the registry vulnerability audit with `scripts/check-supply-chain.mjs`, which checks known compromised versions and suspicious Shai-Hulud artifacts. A clean result is evidence against those known indicators, not a guarantee that every dependency is trustworthy.

If a suspicious package or artifact is found, stop executing it, preserve the lockfile and relevant evidence, and investigate on an isolated machine. Remove or replace the affected dependency, regenerate the lockfile, and repeat validation. Rotate credentials that were accessible to confirmed malicious code and review repository/workflow changes before restoring normal builds.
