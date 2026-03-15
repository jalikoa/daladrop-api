# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps: install only production dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – builder: compile TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – production: lean runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user for security
RUN addgroup -S nfc && adduser -S nfc -G nfc

# curl is needed for the Docker healthcheck in docker-compose.yml
RUN apk add --no-cache curl

# Copy compiled output and production deps only
COPY --from=builder  /app/dist        ./dist
COPY --from=deps     /app/node_modules ./node_modules
COPY package.json ./

# Create log directory owned by the app user
RUN mkdir -p /app/logs && chown nfc:nfc /app/logs

USER nfc

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:3000/health/ready || exit 1

CMD ["node", "dist/main.js"]