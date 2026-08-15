# ============================================
# Minlish Backend — Dockerfile
# Multi-stage build: Development + Production
# ============================================

# ─────────────────────────────────────────────
# Stage 1: Base — Common dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# ─────────────────────────────────────────────
# Stage 2: Development
# ─────────────────────────────────────────────
FROM base AS development

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Watch mode with ts-node-dev
CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────
# Stage 3: Build — TypeScript compilation
# ─────────────────────────────────────────────
FROM base AS builder

# Install all dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# ─────────────────────────────────────────────
# Stage 4: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start application
CMD ["node", "dist/server.js"]

# ─────────────────────────────────────────────
# Build instructions:
# ─────────────────────────────────────────────
# Development:
#   docker build --target development -t minlish:dev .
#   docker run -p 3000:3000 -v $(pwd)/src:/app/src minlish:dev
#
# Production:
#   docker build --target production -t minlish:prod .
#   docker run -p 3000:3000 minlish:prod
#
# Full stack (with compose):
#   docker-compose up --build
