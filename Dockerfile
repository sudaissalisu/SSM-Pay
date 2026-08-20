# =============================================================================
# SSM-Pay Multi-Stage Docker Build
# =============================================================================
# Optimized production-ready Docker image for Next.js enterprise payment platform
# Based on official Next.js Docker best practices
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base Image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install dependencies required for native modules
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    ca-certificates

# Set working directory
WORKDIR /app

# Set environment variables for base image
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PYTHON_UNBUFFERED=1

# -----------------------------------------------------------------------------
# Stage 2: Dependencies Installation
# -----------------------------------------------------------------------------
FROM base AS deps

# Enable corepack and install bun
RUN corepack enable && corepack prepare bun@latest --activate

# Copy package files first for better caching
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies needed for build)
RUN bun install --frozen-lockfile || bun install

# -----------------------------------------------------------------------------
# Stage 3: Application Builder
# -----------------------------------------------------------------------------
FROM base AS builder

# Enable corepack and bun
RUN corepack enable && corepack prepare bun@latest --activate

# Resolve and copy dependencies from deps stage
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build time
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_NAME=SSM-Pay \
    ANALYZE=false

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application with standalone output mode
# This creates a self-contained build that doesn't need node_modules at runtime
RUN bun run build

# -----------------------------------------------------------------------------
# Stage 4: Production Runner
# -----------------------------------------------------------------------------
FROM base AS runner

# Enable corepack for runtime
RUN corepack enable && corepack prepare bun@latest --activate

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    # Security headers
    DISABLE_SSR_LOGGING=true \
    # Performance optimizations
    NODE_OPTIONS="--max-old-space-size=4096"

# Copy built application from builder stage
# Public assets (static files)
COPY --from=builder /app/public ./public

# Standalone output - includes minimal node_modules and server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static assets generated during build
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema and engine if using database migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]

# =============================================================================
# Development Stage (Optional - for local development with Docker)
# =============================================================================
FROM base AS development

# Enable corepack and bun
RUN corepack enable && corepack prepare bun@latest --activate

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies including dev dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port for hot reload
EXPOSE 3000

# Start development server with hot reload
CMD ["bun", "run", "dev"]

# =============================================================================
# Build Arguments Documentation
# =============================================================================
# The following build arguments can be passed during docker build:
#
# NEXT_PUBLIC_APP_NAME   - Application name (default: SSM-Pay)
# NEXT_PUBLIC_APP_URL    - Application URL (default: http://localhost:3000)
# NODE_ENV               - Node environment (default: production)
# ANALYZE                - Enable bundle analysis (default: false)
#
# Example usage:
#   docker build \
#     --build-arg NEXT_PUBLIC_APP_NAME="SSM-Pay Production" \
#     --target runner \
#     -t ssmpay:latest .
# =============================================================================
