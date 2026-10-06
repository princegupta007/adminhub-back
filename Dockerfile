# ==============================================================================
# Stage 1: Base Alpine Image
# ==============================================================================
FROM node:22-alpine AS base
WORKDIR /app
# Install openssl (for Prisma query engine on Alpine) and dumb-init (PID 1 process manager)
RUN apk add --no-cache openssl dumb-init

# ==============================================================================
# Stage 2: Install Dependencies & Generate Prisma Client
# ==============================================================================
FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
# Install all dependencies including devDependencies to enable build and prisma generation
RUN npm ci && npx prisma generate

# ==============================================================================
# Stage 3: Build TypeScript Application
# ==============================================================================
FROM dependencies AS builder
WORKDIR /app
COPY tsconfig.json nest-cli.json ./
COPY src ./src/
RUN npm run build
# Prune development dependencies so only production packages remain
RUN npm prune --omit=dev

# ==============================================================================
# Stage 4: Minimal Production Runtime
# ==============================================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Security: Run as unprivileged non-root user
USER node

# Copy production dependencies, build output, prisma files, and entrypoint
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Expose API port
EXPOSE 4000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health/live || exit 1

# Forward signals properly using dumb-init
ENTRYPOINT ["dumb-init", "--", "/bin/sh", "./scripts/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
