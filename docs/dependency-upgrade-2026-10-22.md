# Dependency review — October 22, 2026

Historical review; see the [October 23 follow-up](dependency-upgrade-2026-10-23.md) for the current Bun and dependency refresh.

Reviewed from commit `97360fbdd00bf8e9cfefd0a828ec268c349a6c64`. The upgrade preserves Bun workspaces, the committed lockfile, the 72-hour npm release-age gate, server-only credentials, existing public contracts, and the production image baseline.

## Findings and selected versions

The baseline registry audit reported six advisories through Vite 8.3.2: one high, four moderate, and one low. [Vite's security advisory](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) and [8.3.3 release](https://github.com/vitejs/vite/releases/tag/v8.3.3) identify the patched line, including launch-editor and filesystem access fixes. The selected [8.3.4 release](https://github.com/vitejs/vite/releases/tag/v8.3.4) also fixes stylesheet preloading and development-server behavior.

| Area | Baseline | Selected | Reason |
| --- | --- | --- | --- |
| Vite | 8.3.2 | 8.3.4 | Security patches and compatible build fixes |
| AI SDK | 7.0.127 | 7.0.143 | Streaming, cancellation, approval, and replay fixes |
| AI React / MCP / OTel | 4.0.130 / 2.0.66 / 1.0.127 | 4.0.147 / 2.0.78 / 1.0.143 | Keep SDK packages and provider contracts aligned |
| AI provider utilities | 5.0.53 | 5.0.62 | Exact version requested by the selected SDK packages |
| React / React DOM | 19.3.0 | 19.3.1 | Compatible patch |
| Better Auth / Drizzle adapter | 1.7.7 | 1.7.10 | Paired compatible patches |
| Sentry SDK / Vite plugin | 11.4.0 / 5.4.1 | 11.8.0 / 11.8.0 | SDK and bundler packages now release together |
| Langfuse | 5.13.1 | 5.14.0 | Compatible release without changing backend requirements |
| KaTeX | 0.18.9 | 0.18.11 | Matching renderer markup and stylesheet |
| unpdf | 1.8.1 | 1.9.1 | PDF.js 6.4 and metadata fixes |
| Vitest / V8 coverage | 5.0.3 | 5.0.5 | Paired test-runner patches |
| jsdom | 30.1.2 | 30.1.3 | Compatible patch |
| Playwright | 1.63.0 | 1.64.1 | Browser test tooling update |
| Node development tooling | Implicit runner executable | 24.22.1 LTS | Explicit runtime meeting Vitest/jsdom engines and current security release |

Other compatible dependencies and overrides were refreshed with `bun update --recursive`; the manifests and lockfile contain the complete graph. DOMPurify moves to 3.4.17, gRPC to 1.14.6, OpenTelemetry core to 2.12.0, PostCSS to 8.5.31, and UUID to 14.0.3. No lifecycle scripts remain blocked or unreviewed according to `bun pm untrusted`.

## Compatibility work

The [AI SDK changelog](https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md) changes experimental decision state arrays into ordered input parts. Jev now wraps JSON state in a JSON part so JSON arrays remain data. A regression exercises both object and array inputs at the provider seam. No model or prompt change is part of this dependency selection.

[unpdf 1.9](https://github.com/unjs/unpdf/releases/tag/v1.9.0) upgrades PDF.js to 6.4. The document proxy no longer owns `destroy()`; cleanup uses `pdf.loadingTask.destroy()` as defined by [PDF.js's document/loading-task API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html). A real selectable one-page PDF regression catches extraction or cleanup failures.

[Sentry 11.8](https://github.com/getsentry/sentry-javascript/releases/tag/11.8.0) consolidates the Vite plugin into SDK releases and preserves plugin options. It changes its CLI implementation; self-hosted Sentry must remain at least 26.4.2. Source-map upload still requires explicit credentials and has to be verified in the configured release environment.

Vitest/jsdom execution under Bun's fallback Node executable fails before DOM tests run. Client test and coverage scripts now invoke Node explicitly; CI reads the exact version from `.nvmrc` through a SHA-pinned official setup-node action. [Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1) is an LTS security release. Local verification can use supported Node 22.22.2+, Node 24.15.0+, or Node 26+; the bundled local runtime used for this review is 24.19.0. Bun 1.4.3 remains the [current Bun release](https://bun.com/blog/bun-v1.4.3) and the production runtime.

## Deliberate holds

- [Langfuse 6](https://langfuse.com/docs/observability/sdk/upgrade-path/js-v5-to-v6) requires Langfuse Cloud or self-hosted 4.59.0+. The deployment may point at an existing backend, so the compatible 5.14 release is selected until that server requirement is verified.
- Babel 8 and Mermaid 12 exceed their consumers' supported major lines. Their existing compatible overrides remain.
- KaTeX 0.19 is a new rendering line; keep 0.18.11 until a separate markup/style migration is verified.
- AI SDK releases newer than 7.0.143 were not eligible under the existing npm release-age gate at review time.
- Bun 1.4.3, TypeScript 7.0.2, and the Drizzle 1.0.0-rc.4 pair were already current within the selected release lines.

## Verification and rollout

- `bun ci`: passed without manifest/lockfile changes after installation.
- `bun run security:check`: passed; no vulnerabilities found across 866 audited packages, and no known supply-chain indicators found.
- `bun pm untrusted`: zero untrusted dependencies with lifecycle scripts.
- Focused Jev and real PDF extraction regressions passed after the compatibility changes.
- CI and Sonar YAML parsed; every job explicitly selects `.nvmrc`.
- `DEPLOY_CHECK_USE_VALUES_TEMPLATE=1 DEPLOY_CHECK_REQUIRE_DOCKER=1 bun run check:deploy`: Compose validation, Dockerfile checks, and Helm checks/rendering passed across Kubernetes 1.35.9, 1.36.5, and 1.37.1.

The complete application test/build/browser and live-model results are recorded in the [engineering review](engineering-review-2026-10-22.md). Production client/server images and their non-root, read-only smoke tests also passed. No database schema change is required by these dependency upgrades. Rollback uses the previous application revision and matching lockfile. Observe API readiness, PDF extraction, streamed chat completion/cancellation, saved-conversation resume, tool approvals, and optional telemetry delivery after rollout.
