# Infrastructure review — October 23, 2026

This review covers the delivery changes since commit `97360fbdd00bf8e9cfefd0a828ec268c349a6c64`, including the October 22 security refresh and the requested [Bun 1.4.4 release](https://bun.com/blog/bun-v1.4.4). Application contracts, PostgreSQL major version 18, Redis 8.10.2, persisted volumes, non-root containers, read-only application filesystems, and unbuffered SSE proxying are preserved. No resources were deployed to the user's existing cluster.

## Selected releases

| Component | Baseline | Selected | Evidence and compatibility |
| --- | --- | --- | --- |
| Bun | 1.4.3 | 1.4.4 | Official October 22 release; Docker/Compose examples and both CI workflows match the package-manager runtime |
| Nginx | 1.31.6 | 1.31.8, Alpine 3.24 | Includes [five security fixes in 1.31.7](https://nginx.org/en/CHANGES), plus compatible 1.31.8 fixes |
| Traefik | 3.7.13 | 3.7.16 | [3.7.15 security fixes](https://github.com/traefik/traefik/releases/tag/v3.7.15) and [3.7.16 ForwardAuth identity isolation fix](https://github.com/traefik/traefik/security/advisories/GHSA-hrpp-p4fc-wwf8) |
| pgvector | 0.8.6 | 0.8.7 on PostgreSQL 18, Debian trixie | [CVE-2026-103484 IVFFlat build overflow fix](https://www.postgresql.org/about/news/pgvector-087-released-3392/); no PostgreSQL major upgrade |
| Traefik Helm chart | 41.6.0 | 42.1.2 | [Official chart release](https://github.com/traefik/traefik-helm-chart/releases/tag/v42.1.2) selects Traefik 3.7.16; Kubernetes minimum 1.30 fits the app's 1.35–1.37 range |
| Gateway API | 1.6.2 | 1.6.3 Standard | [Official release](https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.6.3) and [Traefik support matrix](https://doc.traefik.io/traefik/reference/install-configuration/providers/kubernetes/kubernetes-gateway/) agree |
| App Helm chart | 0.6.3 | 0.6.4 | Records changed image defaults and configuration guards |
| Helm / kind | 4.3.1 / 0.33.0 | Preserved | Existing current release lines; kind's published node image is Kubernetes 1.37.0 |
| Kubernetes tooling / CI | kubectl 1.37.1 in CI, host client 1.33.9 | Shared kubectl 1.36.5 pin, same kind 1.37.0 node, schemas 1.37.1 | The middle supported client minor covers servers 1.35–1.37; published schemas are updated independently of the kind node |

Chart 42's breaking changes raise the minimum Kubernetes version and alter Traefik Hub secret permissions/transparency-log settings. This project uses Traefik Proxy without Hub configuration. The downloaded chart was linted and rendered with the generated values before selecting it.

The hardened Traefik 3.7.16 image tag was unavailable at the initial registry check, so the generated local controller defaults to the verified official public image. Explicit hardened-image overrides remain supported. Production Redis retains its existing DHI release line; local/test Redis retains its public upstream release line. Changing a chart image repository requires a matching digest, or an explicit empty digest when deliberately selecting by tag.

## Immutable image identities

These multi-platform manifest digests were verified against the upstream registries. Bun, Nginx, Traefik, and pgvector include both Linux amd64 and arm64 platforms.

| Image | Selected manifest digest |
| --- | --- |
| `oven/bun:1.4.4-alpine` (CI) | `sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a` |
| `nginx:1.31.8-alpine3.24` | `sha256:1ef7ca94d7879df82421428ce13bd1eaa412404953859cf7a5b6512c25e67a60` |
| `traefik:v3.7.16` | `sha256:c8a121e4bb1347e8fd52657fab12f2cb70b68f8a018895e2068f92c9e519b9c2` |
| `pgvector/pgvector:0.8.7-pg18-trixie` | `sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0` |
| `dhi.io/redis:8.10.2-debian13` (production chart) | `sha256:cfe44744ab9042a64dbfa89d2be9037d7058d12347e496521b31ce00f410c1a5` |
| `redis:8.10.2-trixie` (local/test chart) | `sha256:97ec88159e6d7cfb5ddef9015386087d58a912de80112f06ebdfa78fa5989901` |
| `curlimages/curl:8.22.0` (Helm tests) | `sha256:58adaa4e8dca9c988bae2aba4ab3434a0bb2da16bbe3f92dec39ec7785166777` |
| `kindest/node:v1.37.0` (CI) | `sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5` |

The OCI chart `ghcr.io/traefik/helm/traefik:42.1.2` resolved to `sha256:b3ff8020c28455622d532bd97a67fbd5e843a6a0be64c005ea954193b63a62f1` when downloaded on October 23. Nginx and Traefik republished their unchanged version tags between the October 22 and October 23 registry checks; the source pins were refreshed to the October 23 manifests. Tags alone do not identify immutable image contents.

## Kubernetes setup and validation

Direct app/controller deployment scripts now run the same Kubernetes compatibility gate as the Make workflow before generating local values or mutating cluster resources. Generated controller values scope cross-provider references to `K8S_APP_NAMESPACE` and the controller namespace, matching the Gateway listener selector when a custom application namespace is used.

Read-only inspection on October 22 observed OrbStack Kubernetes `1.36.5+orb1` with a ready arm64 node, no application/controller Helm releases, and no Gateway CRDs. The globally installed kubectl was `1.33.9`, outside the [supported one-minor skew](https://kubernetes.io/releases/version-skew-policy/). The repository gate rejected that combination. A temporary checksum-verified kubectl `1.37.1` passed the gate and server-side dry-run validation of 26 native application resources; Gateway resources were disabled because the CRDs were absent. This did not install CRDs or create persisted resources, and did not replace global tooling.

At the start of October 23 verification, Docker's socket and the Kubernetes API endpoint were unavailable. After OrbStack was started, the deployment gate and a new server-side dry run passed with the final Bun 1.4.4 source pins. The initial temporary client established compatibility without changing global tooling.

The ordinary workflow now selects the managed `scripts/bin/kubectl` wrapper through Make and all direct deployment helpers. Both CI cluster jobs read its shared `.kubectl-version` pin, `v1.36.5`, which covers all advertised 1.35–1.37 server minors. First use downloads the official platform binary and checksum from `dl.k8s.io`; the ignored `.local/bin/` cache is verified before each execution and can be used offline. Application `.env` files are not loaded by the launcher, and global kubectl remains unchanged. Long-lived children receive SIGINT/SIGTERM and are reaped before the wrapper exits, preventing leaked port-forward processes.

Fresh October 23 checks:

- `DOCKER_CONTEXT=orbstack DEPLOY_CHECK_USE_VALUES_TEMPLATE=1 DEPLOY_CHECK_REQUIRE_DOCKER=1 bun run check:deploy`: passed Compose validation, all three Dockerfile build checks with no warnings, strict Helm lint/render cases across Kubernetes 1.35.9, 1.36.5, and 1.37.1, and negative configuration cases. An earlier daemon-unavailable run correctly skipped Docker checks; the final run required them.
- Downloaded Traefik chart 42.1.2: strict lint and render passed with synthetic generated values, the selected immutable proxy image, Gateway API enabled, and a custom application namespace. No private environment files were read to generate that fixture.
- Exported 29 structural schemas directly from official Gateway API 1.6.3 and Traefik 3.7.16 CRDs. A checksum-verified kubeconform 0.8.0 validated all 12 rendered Gateway/Traefik resources: zero invalid resources, errors, or skips. This verifies structural schemas; controller behavior and Kubernetes CEL checks still require the target cluster.
- All 26 native application resources validated against published Kubernetes 1.37.1 schemas with zero invalid resources, errors, or skips. A fresh server-side dry run against OrbStack 1.36.5 also passed for all 26, with Gateway disabled because its CRDs were not installed.
- Real managed kubectl 1.36.5 download and checksum verification passed. With the old global 1.33.9 client still installed, ordinary `DOCKER_CONTEXT=orbstack make k8s-prerequisites` passed against OrbStack 1.36.5+orb1; the same managed client passed the compatibility gate against isolated kind 1.37.0. Fixture checks reject the old client, cover server minors 35/36/37, fail closed on corrupted downloads/cache, exercise both direct deployment entrypoints before mutation, and verify signal cleanup. The signal regression first failed by retaining open pipes, then passed after asynchronous child forwarding replaced synchronous execution.
- Shell syntax and workflow YAML parsing passed; both workflows select Bun 1.4.4 and CI uses its verified multi-platform digest. All three Bun 1.4.4 application images built; final server/client container smoke tests and the migration runtime check passed. Live Gateway checks passed under the new runtime with both tested models. Complete evidence is recorded in the [Bun 1.4.4 upgrade audit](bun-upgrade-1.4.4.md).

## Stateful rollout and rollback

Take recoverable PostgreSQL and Redis backups before replacing their images. Local preflight found explicit older public image values that shadowed the refreshed defaults. Those narrowly recognized overrides now select pgvector 0.8.7, Redis 8.10.2, and Traefik 3.7.16 with matching digests; recognized controller/chart/Gateway overrides were aligned too. Other custom settings and credentials were preserved. No services were restarted by this configuration update. Existing generated values must be regenerated by the normal deployment workflow after its compatibility gate passes.

The pgvector image includes extension binaries and upgrade scripts, but replacing the image does not change `pg_extension.extversion` in an existing database. After bringing up the reviewed PostgreSQL 18 image, inspect both the available default and installed version using PostgreSQL's [extension availability view](https://www.postgresql.org/docs/18/view-pg-available-extensions.html):

```sql
SELECT name, installed_version, default_version
FROM pg_available_extensions
WHERE name = 'vector';

SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

For a fresh database the expected installed/default version is 0.8.7 after migrations. An existing database can report installed 0.8.6 and default 0.8.7. Following the [pgvector upgrade procedure](https://github.com/pgvector/pgvector#upgrading), a privileged database operator should review and run the extension update for that database after the backup and image replacement:

```sql
ALTER EXTENSION vector UPDATE TO '0.8.7';
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT '[1,0]'::vector <=> '[1,0]'::vector AS same_vector_distance;
```

The expected final version is 0.8.7 and the distance is zero. Follow with the authenticated embedding/search/RAG smoke checks. No historical migration is rewritten and no extension update runs against user data as part of this review. PostgreSQL remains on major 18; `pg_upgrade` is not needed for this image change.

After the extension catalog is updated, rollback needs an image providing at least that installed extension version, or restoration of the pre-upgrade database backup. Do not roll the database back to the 0.8.6 image while retaining a 0.8.7 extension catalog. App rollback uses the previous application image and matching lockfile. Gateway CRDs are cluster-scoped and remain in place when rolling back the controller chart; they require their own reviewed recovery procedure.

Monitor readiness, nginx proxy errors, streamed response completion/cancellation, controller route acceptance, database health/vector queries, and Redis connectivity. Failed probes, unavailable routes, or vector errors are rollback triggers after accounting for extension compatibility.
