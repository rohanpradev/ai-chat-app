# Security Policy

## Reporting

Do not open public issues for vulnerabilities, leaked secrets, or suspected supply-chain compromise. Contact the maintainer privately and include:

- Affected commit, image tag, package version, or deployment target
- Reproduction steps and expected impact
- Whether credentials, user data, CI secrets, or package publishing rights may be exposed

If a secret may have leaked, rotate it before sending the report.

## Supported Posture

This project treats the following as release blockers:

- Known high or critical dependency vulnerabilities reachable from runtime code
- Known compromised package versions in `bun.lock`
- Wildcard credentialed CORS in production
- Exposed API keys, database credentials, JWT secrets, npm tokens, cloud credentials, or CI secrets
- Broken auth cookie security attributes in production
- Docker or Kubernetes manifests that require privileged application containers

## Local Checks

```bash
bun install --frozen-lockfile
bun run security:check
bun run check
```

`security:check` runs `bun audit` and `scripts/check-supply-chain.mjs`. The supply-chain scan is intentionally small and deterministic; it catches known Shai-Hulud-style indicators and affected package versions but does not replace external SCA, malware scanning, or secret scanning.

## Incident Response

For suspected dependency compromise:

1. Stop automated deploys and package updates.
2. Preserve `bun.lock`, CI logs, and container image digests.
3. Rotate OpenAI, Serper, Langfuse, Sentry, database, Redis, GitHub, npm, cloud, and Kubernetes credentials that were available to affected machines or CI jobs.
4. Remove compromised package versions, reinstall from a clean machine with `bun install --frozen-lockfile`, and rebuild images from scratch.
5. Run `bun run security:check`, tests, image scans, and deployment smoke tests before restoring deploys.
