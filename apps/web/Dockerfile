# ──────────────────────────────────────────────────
# Stage 1: Dependencies
# ──────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/domain/package.json ./packages/domain/
COPY packages/knowledge/package.json ./packages/knowledge/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/devkit/package.json ./packages/devkit/
COPY apps/web/package.json ./apps/web/

RUN npm install --legacy-peer-deps

# ──────────────────────────────────────────────────
# Stage 2: Builder
# ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY packages/ ./packages/
COPY tooling/ ./tooling/
COPY apps/web/ ./apps/web/
COPY package.json ./

# Build packages dan Next.js dengan standalone output
RUN npm run build --workspace=packages/core && \
    npm run build --workspace=packages/domain && \
    npm run build --workspace=packages/knowledge && \
    npm run build --workspace=packages/contracts && \
    npm run build --workspace=packages/devkit && \
    cd apps/web && npm run build

# ──────────────────────────────────────────────────
# Stage 3: Production Runtime
# ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Salin standalone output dan node_modules yang dibutuhkan
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Jalankan Next.js standalone server
CMD ["sh", "-c", "if [ -f apps/web/server.js ]; then node apps/web/server.js; elif [ -f server.js ]; then node server.js; else find . -name server.js -exec node {} \\;; fi"]
