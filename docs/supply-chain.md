# Dependency maintenance

Use Bun workspaces, the root dependency catalog, and the committed `bun.lock`. CI and production installs use `bun ci` to reject manifest/lockfile drift. The 72-hour minimum release age in `bunfig.toml` applies to fresh dependency resolution; preserve it during routine upgrades.

The runtime baseline is Bun 1.4.3. Keep the package-manager pin, runtime engines, Bun type packages, Docker defaults, Compose defaults, environment examples, and both CI workflows aligned. Verify the multi-platform Docker digest when changing CI's Bun image. The [Bun upgrade audit](bun-upgrade.md) records feature decisions and rollout checks. Native checks are the default; `bun run typecheck:tsc` retains TypeScript 7.0.2 for comparison.

For a refresh, run `bun outdated --filter '*'`, review upstream release notes, and use `bun update --latest --recursive`. Review root overrides separately: updating direct dependencies does not refresh those pins. Keep overrides within the parent package's supported range unless a reviewed migration and runtime checks cover the change.

The October 2026 refresh keeps Babel 7 and Mermaid 11 compatible with their consumers. The KaTeX 0.18.9 override is intentional: its public rendering API remains compatible, but its internal CSS classes changed, so all renderers and the stylesheet must move together. Desktop and mobile browser tests check the new markup and loaded styles. The follow-up refresh uses AI SDK 7.0.127, MCP 2.0.66, Motion 14, Streamdown 2.7 and code plugin 2, while preserving the KaTeX 0.18 override pending its own rendering migration. Vitest 5.0.3 and jsdom 30.1.2 require Node on PATH when running the browser unit tests; letting Bun substitute for the missing Node executable fails jsdom EventTarget initialization. The AI SDK provider utilities are aligned with the exact version requested by the upgraded SDK packages.

Before shipping, run `bun run security:check`, `bun run check`, `bun run knip`, `bun run check:migrations`, `bun run build:report`, and `bun run test:e2e`. Review new package owners, lifecycle scripts, binary downloads, and unexpected workflow or generated-file changes. `bun run check:ci` also validates deployment configuration; it requires the relevant local deployment tools.

`security:check` combines the registry vulnerability audit with `scripts/check-supply-chain.mjs`, which checks known compromised versions and suspicious Shai-Hulud artifacts. A clean result is evidence against those known indicators, not a guarantee that every dependency is trustworthy.

If a suspicious package or artifact is found, stop executing it, preserve the lockfile and relevant evidence, and investigate on an isolated machine. Remove or replace the affected dependency, regenerate the lockfile, and repeat validation. Rotate credentials that were accessible to confirmed malicious code and review repository/workflow changes before restoring normal builds.
