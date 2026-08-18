# ──────────────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies untuk monorepo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/devkit/package.json ./packages/devkit/
COPY packages/domain/package.json ./packages/domain/
COPY packages/knowledge/package.json ./packages/knowledge/
COPY apps/api/package.json ./apps/api/

# Install semua deps termasuk devDependencies (diperlukan untuk build)
RUN npm install --legacy-peer-deps

# Copy source code packages
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build NestJS API
RUN cd apps/api && npm run build

# ──────────────────────────────────────────────────
# Stage 2: Production Runtime
# ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Install hanya production dependencies
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/devkit/package.json ./packages/devkit/
COPY packages/domain/package.json ./packages/domain/
COPY packages/knowledge/package.json ./packages/knowledge/
COPY apps/api/package.json ./apps/api/

RUN npm install --legacy-peer-deps --omit=dev

# Copy hasil build
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema dan generated client
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy source packages (diperlukan jika ada module resolution non-compiled)
COPY --from=builder /app/packages ./packages

EXPOSE 3001

# Jalankan API
CMD ["node", "apps/api/dist/main"]
