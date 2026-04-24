# syntax=docker/dockerfile:1

ARG BUN_DEV_IMAGE=dhi.io/bun:1.3.12-dev
ARG BUN_RUNTIME_IMAGE=dhi.io/bun:1.3.12
ARG NGINX_IMAGE=dhi.io/nginx:1.30.0

# Stage 1: Workspace manifests only.
FROM ${BUN_DEV_IMAGE} AS workspace-manifests
WORKDIR /app

COPY package.json bun.lock* ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

# Stage 2: Production dependencies only.
FROM workspace-manifests AS prod-deps
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --filter 'chat-app' --filter './server' --filter './shared'

# Stage 3: Build dependencies (includes dev deps).
FROM workspace-manifests AS build-deps
COPY tsconfig.json ./
COPY client/tsconfig.json ./client/tsconfig.json
COPY shared/tsconfig.json ./shared/tsconfig.json
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --filter 'chat-app' --filter './client' --filter './shared'

# Copy shared source needed by the client build after dependencies are cached.
COPY shared/ ./shared/

# Stage 4: Client build.
FROM build-deps AS client-build
WORKDIR /app

# Copy client source
COPY client/ ./client/

# Build client
WORKDIR /app/client
RUN bun run build

# Stage 5: Client production.
FROM ${NGINX_IMAGE} AS client-prod
USER 0
WORKDIR /app

# Shell-less nginx images (e.g. distroless) cannot execute RUN instructions.
# Copy build output directly instead of cleaning defaults via /bin/sh.
COPY --from=client-build --chown=65532:65532 --chmod=0555 /app/client/dist/ /app/static/
COPY --from=client-build --chown=65532:65532 --chmod=0444 /app/client/nginx.conf /etc/nginx/templates/default.conf.template

USER 65532
EXPOSE 80
CMD ["-g", "daemon off;"]

# Stage 6: Server production.
FROM ${BUN_RUNTIME_IMAGE} AS server-prod
WORKDIR /app

# Copy production dependencies
COPY --from=prod-deps --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=prod-deps --chown=65532:65532 /app/package.json ./

# Copy shared package (runtime dependency)
COPY --chown=65532:65532 shared/ ./shared/

# Copy only runtime server files to keep the final image lean.
COPY --chown=65532:65532 server/package.json ./server/package.json
COPY --chown=65532:65532 server/tsconfig.json ./server/tsconfig.json
COPY --chown=65532:65532 server/src ./server/src

WORKDIR /app/server

USER 65532
ENV SERVER_PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=2 \
  CMD bun -e "fetch('http://localhost:'+(process.env.SERVER_PORT||'3000')+'/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
