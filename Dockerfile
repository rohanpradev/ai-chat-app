# Stage 1: Production dependencies only
FROM oven/bun:1-alpine AS prod-deps
WORKDIR /app

# Install essential system dependencies only
RUN apk upgrade --no-cache && \
    apk add --no-cache ca-certificates

# Copy package files for dependency resolution
COPY package.json bun.lockb* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Stage 2: Build dependencies (includes dev deps)
FROM oven/bun:1-alpine AS build-deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache ca-certificates

# Copy package files
COPY package.json ./
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
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN if [ -z "$VITE_API_URL" ]; then echo "ERROR: VITE_API_URL build argument is required" && exit 1; fi && \
    bun run build

# Stage 4: Client production (minimal nginx)
FROM nginx:1.27-alpine AS client-prod
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Clean up default nginx files
RUN rm -rf /usr/share/nginx/html/* && \
    rm /etc/nginx/conf.d/default.conf

# Copy built assets and config
COPY --from=client-build --chown=nginx:nginx /app/client/dist /usr/share/nginx/html
COPY --from=client-build /app/client/nginx.conf /etc/nginx/templates/default.conf.template

# Set permissions but don't switch to nginx user yet (let template processing happen as root)
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Stage 5: Server production (minimal)
FROM oven/bun:1-alpine AS server-prod
WORKDIR /app

# Install only essential runtime dependencies
RUN apk upgrade --no-cache && \
    apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Copy production dependencies
COPY --from=prod-deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=prod-deps --chown=appuser:appuser /app/package.json ./

# Copy shared package (runtime dependency)
COPY --chown=appuser:appuser shared/ ./shared/

# Copy server source
COPY --chown=appuser:appuser server/ ./server/

# Set working directory
WORKDIR /app/server

# Remove dev-only files to save space
RUN rm -rf ../shared/node_modules/.cache || true && \
    rm -rf node_modules/.cache || true && \
    rm -rf ../node_modules/.cache || true

USER appuser

# Health check should use environment variable for port
ENV PORT=3000
EXPOSE $PORT

# Health check using environment variable for port
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=2 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["bun", "run", "src/index.ts"]
