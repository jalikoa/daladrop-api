################################################################################
# Dockerfile
#
# PURPOSE:
# Multi-stage build for the NestJS API.
# Optimized for small image size, security (non-root user), and fast builds.
#
# USAGE:
#   docker build -t api:latest --target production .
################################################################################

# ============================================================================
# STAGE 1: Dependencies
# Install only production dependencies to cache this layer effectively.
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ============================================================================
# STAGE 2: Builder
# Install all dependencies (including dev) and compile TypeScript.
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ============================================================================
# STAGE 3: Production
# Lean runtime image with compiled output and production dependencies only.
# ============================================================================
FROM node:20-alpine AS production
WORKDIR /app

# Security: Create a non-root user and group
RUN addgroup -S api && adduser -S api -G api

# Install curl for Docker healthchecks
RUN apk add --no-cache curl

# Copy compiled output from builder and production deps from deps stage
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Create and set permissions for the logs directory
RUN mkdir -p /app/logs && chown api:api /app/logs

# Switch to non-root user
USER api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck to ensure the application is responsive
# Path matches the PublicController we built earlier
HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -f http://localhost:3000/public/health || exit 1

CMD ["node", "dist/main.js"]