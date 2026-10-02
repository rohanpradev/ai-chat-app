# Dependency maintenance

Use Bun workspaces, the root dependency catalog, and the committed `bun.lock`. CI and production installs use `bun ci` to reject manifest/lockfile drift. The 72-hour minimum release age in `bunfig.toml` applies to fresh dependency resolution; preserve it during routine upgrades.

For a refresh, run `bun outdated --filter '*'`, review upstream release notes, and use `bun update --latest --recursive`. Review root overrides separately: updating direct dependencies does not refresh those pins. Keep overrides within the parent package's supported range unless a reviewed migration and runtime checks cover the change.

The October 2026 refresh keeps Babel 7 and Mermaid 11 compatible with their consumers. The KaTeX 0.18.9 override is intentional: its public rendering API remains compatible, but its internal CSS classes changed, so all renderers and the stylesheet must move together. Desktop and mobile browser tests check the new markup and loaded styles. The AI SDK provider utilities are aligned with the exact version requested by the upgraded SDK packages.

Before shipping, run `bun run security:check`, `bun run check`, `bun run knip`, `bun run check:migrations`, `bun run build:report`, and `bun run test:e2e`. Review new package owners, lifecycle scripts, binary downloads, and unexpected workflow or generated-file changes. `bun run check:ci` also validates deployment configuration; it requires the relevant local deployment tools.

`security:check` combines the registry vulnerability audit with `scripts/check-supply-chain.mjs`, which checks known compromised versions and suspicious Shai-Hulud artifacts. A clean result is evidence against those known indicators, not a guarantee that every dependency is trustworthy.

If a suspicious package or artifact is found, stop executing it, preserve the lockfile and relevant evidence, and investigate on an isolated machine. Remove or replace the affected dependency, regenerate the lockfile, and repeat validation. Rotate credentials that were accessible to confirmed malicious code and review repository/workflow changes before restoring normal builds.
