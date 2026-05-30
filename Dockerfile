# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.14
ARG BUN_DISTRO=debian13
ARG BUN_DEV_IMAGE=dhi.io/bun:${BUN_VERSION}-${BUN_DISTRO}-dev
ARG BUN_RUNTIME_IMAGE=dhi.io/bun:${BUN_VERSION}-${BUN_DISTRO}
ARG NGINX_IMAGE=dhi.io/nginx:1

# Stage 1: Workspace manifests only.
FROM ${BUN_DEV_IMAGE} AS workspace-manifests
WORKDIR /app

COPY --link package.json bun.lock* bunfig.toml ./
COPY --link client/package.json ./client/package.json
COPY --link server/package.json ./server/package.json
COPY --link shared/package.json ./shared/package.json

# Stage 2: Production dependencies only.
FROM workspace-manifests AS prod-deps
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
  bun install --frozen-lockfile --linker isolated --production --filter 'chat-app' --filter './server' --filter './shared'

# Stage 3: Build dependencies (includes dev deps).
FROM workspace-manifests AS build-deps
COPY --link tsconfig.json ./
COPY --link client/tsconfig.json ./client/tsconfig.json
COPY --link server/tsconfig.json ./server/tsconfig.json
COPY --link shared/tsconfig.json ./shared/tsconfig.json
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
  bun install --frozen-lockfile --linker isolated --filter 'chat-app' --filter './client' --filter './server' --filter './shared'

# Copy shared source needed by the client and server builds after dependencies are cached.
COPY --link shared/ ./shared/

# Stage 4: Client build.
FROM build-deps AS client-build
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_APP_NAME=Chat App
ARG VITE_APP_VERSION=1.0.0
ARG VITE_DEV_MODE=false
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=production
ARG VITE_SENTRY_RELEASE=
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
ARG VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
ARG VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0.1
ARG SENTRY_AUTH_TOKEN=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ARG SENTRY_RELEASE=
ARG BASE_API_SLUG=api
ARG SERVER_HOST=server
ARG SERVER_PORT=3000

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_APP_VERSION=${VITE_APP_VERSION} \
    VITE_DEV_MODE=${VITE_DEV_MODE} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT} \
    VITE_SENTRY_RELEASE=${VITE_SENTRY_RELEASE} \
    VITE_SENTRY_TRACES_SAMPLE_RATE=${VITE_SENTRY_TRACES_SAMPLE_RATE} \
    VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=${VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE} \
    VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=${VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE} \
    SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT} \
    SENTRY_RELEASE=${SENTRY_RELEASE}

# Copy client source
COPY --link client/ ./client/

# Build client
WORKDIR /app/client
RUN bun -e 'const fs = require("node:fs"); const replacements = { BASE_API_SLUG: process.env.BASE_API_SLUG ?? "api", SERVER_HOST: process.env.SERVER_HOST ?? "server", SERVER_PORT: process.env.SERVER_PORT ?? "3000" }; let config = fs.readFileSync("nginx.conf", "utf8"); for (const [key, value] of Object.entries(replacements)) config = config.replaceAll("${" + key + "}", value); fs.writeFileSync("nginx.generated.conf", config);'
RUN bun run build

# Stage 5: Server build.
FROM build-deps AS server-build
WORKDIR /app

COPY --link server/ ./server/

WORKDIR /app/server
RUN bun run build

# Stage 6: Client production.
FROM ${NGINX_IMAGE} AS client-prod
USER 0
WORKDIR /app

# Shell-less nginx images (e.g. distroless) cannot execute RUN instructions.
# Copy build output directly instead of cleaning defaults via /bin/sh.
COPY --link --from=client-build --chown=65532:65532 --chmod=0555 /app/client/dist/ /app/static/
COPY --link --from=client-build --chown=65532:65532 --chmod=0444 /app/client/nginx.generated.conf /etc/nginx/conf.d/default.conf

USER 65532
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

# Stage 7: Server production.
FROM ${BUN_RUNTIME_IMAGE} AS server-prod
WORKDIR /app

ENV NODE_ENV=production

# Copy the Bun isolated install layout:
# - root node_modules contains the shared .bun package store
# - workspace node_modules contain dependency symlinks for package-local imports
COPY --link --from=prod-deps --chown=65532:65532 /app/node_modules ./node_modules
COPY --link --from=prod-deps --chown=65532:65532 /app/server/node_modules ./server/node_modules
COPY --link --from=prod-deps --chown=65532:65532 /app/shared/node_modules ./shared/node_modules
COPY --link --from=prod-deps --chown=65532:65532 /app/package.json ./

# Copy shared package (runtime dependency)
COPY --link --chown=65532:65532 shared/ ./shared/

# Copy only runtime server files to keep the final image lean.
COPY --link --chown=65532:65532 server/package.json ./server/package.json
COPY --link --from=server-build --chown=65532:65532 /app/server/dist ./server/dist

WORKDIR /app/server

USER 65532
ENV SERVER_PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=2 \
  CMD bun -e "fetch('http://localhost:'+(process.env.SERVER_PORT||'3000')+'/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "dist/index.js"]
