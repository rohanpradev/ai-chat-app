# Supply-Chain Policy

## Default Install Policy

The repository uses Bun workspaces, an isolated linker, and a committed `bun.lock`.

```bash
bun install --frozen-lockfile
```

`bunfig.toml` sets `minimumReleaseAge = 259200`, which delays fresh resolution of newly published npm versions for 72 hours. This reduces exposure to fast-moving package compromises where malicious versions are published and removed within hours.

## Automated Checks

```bash
bun run audit
bun run security:supply-chain
bun run security:check
```

- `bun audit` checks known vulnerability advisories.
- `security:supply-chain` checks `bun.lock` for known Shai-Hulud/Mini Shai-Hulud affected versions relevant to this stack and scans the repo for known artifact filenames.
- CI runs `security:check` and GitHub dependency review on pull requests.

## Dependency Update Rules

- Prefer small dependency PRs with a readable `bun.lock` diff.
- Treat package updates that add lifecycle scripts, new binary downloads, or unexpected GitHub Actions workflows as high risk.
- Do not bypass `minimumReleaseAge` except for an emergency patch reviewed by a maintainer.
- Keep root `overrides` available for transitive hotfixes.
- For any future published packages, use npm trusted publishing with OIDC and provenance. Do not store long-lived npm publish tokens in CI.

## Shai-Hulud Response

If a compromised npm package is suspected:

1. Freeze deploys and dependency updates.
2. Check `bun.lock` for affected versions and run `bun run security:supply-chain`.
3. Search CI logs for unexpected outbound network calls, publish attempts, or new workflow files.
4. Rotate GitHub tokens, npm tokens, cloud credentials, OpenAI keys, Sentry tokens, Langfuse keys, database passwords, Redis credentials, and Kubernetes service account tokens available to affected hosts.
5. Reinstall dependencies on a clean machine with `bun install --frozen-lockfile`.
6. Rebuild Docker images without cache and redeploy only after tests, audit, and smoke checks pass.

## Current TanStack Note

This repo uses TanStack packages. The locked TanStack versions should be checked when updating because the May 12, 2026 Mini Shai-Hulud wave included compromised TanStack package versions. The local scanner blocks the affected versions known at the time this policy was written.
