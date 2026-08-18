# ──────────────────────────────────────────────────
# Stage 1: Dependencies
# ──────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
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
COPY apps/web/ ./apps/web/
COPY package.json ./

# Build Next.js dengan standalone output
RUN cd apps/web && npm run build

# ──────────────────────────────────────────────────
# Stage 3: Production Runtime
# ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Salin standalone output (hanya file yang dibutuhkan runtime)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Jalankan Next.js standalone server
CMD ["node", "apps/web/server.js"]
