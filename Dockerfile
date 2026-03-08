# syntax=docker/dockerfile:1

ARG BUN_DEV_IMAGE=dhi.io/bun:1.3.9-dev
ARG BUN_RUNTIME_IMAGE=dhi.io/bun:1.3.9
ARG NGINX_IMAGE=dhi.io/nginx:1.29.5

# Stage 1: Production dependencies only
FROM ${BUN_DEV_IMAGE} AS prod-deps
WORKDIR /app

# Copy package files for dependency resolution
COPY package.json bun.lock* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install all dependencies (needed for monorepo workspace resolution)
RUN bun install --frozen-lockfile

# Stage 2: Build dependencies (includes dev deps)
FROM ${BUN_DEV_IMAGE} AS build-deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install all dependencies (including dev for building)
RUN bun install --frozen-lockfile

# Copy shared source (needed for builds)
COPY shared/ ./shared/

# Stage 3: Client build
FROM build-deps AS client-build
WORKDIR /app

# Copy client source
COPY client/ ./client/

# Build client
WORKDIR /app/client
RUN bun run build

# Stage 4: Client production
FROM ${NGINX_IMAGE} AS client-prod
USER 0
WORKDIR /app

# Shell-less nginx images (e.g. distroless) cannot execute RUN instructions.
# Copy build output directly instead of cleaning defaults via /bin/sh.
COPY --from=client-build --chown=65532:65532 --chmod=0555 /app/client/dist/ /usr/share/nginx/html/
COPY --from=client-build --chown=65532:65532 --chmod=0444 /app/client/nginx.conf /etc/nginx/templates/default.conf.template

USER 65532
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Stage 5: Server production
FROM ${BUN_RUNTIME_IMAGE} AS server-prod
WORKDIR /app

# Copy production dependencies
COPY --from=prod-deps --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=prod-deps --chown=65532:65532 /app/package.json ./

# Copy shared package (runtime dependency)
COPY --chown=65532:65532 shared/ ./shared/

# Copy server source
COPY --chown=65532:65532 server/ ./server/

WORKDIR /app/server

USER 65532
ENV SERVER_PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=2 \
  CMD bun -e "fetch('http://localhost:'+(process.env.SERVER_PORT||'3000')+'/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
