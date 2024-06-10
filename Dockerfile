# =============================================================================
# SSM-Pay Payment Platform - Multi-Stage Docker Build
# =============================================================================
# Production-ready Dockerfile for Next.js application with:
# - Multi-stage build for optimized image size
# - Node.js 20 Alpine base for minimal footprint
# - Proper layer caching for faster builds
# - Non-root user for security
# - Health check endpoint
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install dependencies in a separate stage to leverage Docker cache
# Only rebuild this stage when package.json or lock file changes
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 2: Builder
# Build the Next.js application with production optimizations
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Set environment variables for production build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_USE_NETLIFY_TAGS=true

# Build the application
# Note: standalone output creates a self-contained deployment
RUN npx next build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# Minimal production image with only necessary files
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install minimal runtime dependencies
RUN apk add --no-cache \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/Africa/Lagos /etc/localtime \
    && echo "Africa/Lagos" > /etc/timezone \
    && apk del tzdata

# Create required directories with proper permissions
RUN mkdir -p /app/.next /app/.next/cache /app/.next/static && \
    chown -R nextjs:nodejs /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE ${PORT}

# Set health check endpoint
# Next.js exposes /api/health by default, or use a custom one
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:${PORT}/api/health || exit 1

# Environment variables for runtime
ENV NEXT_RUNTIME=nodejs
ENV SERVER_URL=http://localhost:3000
ENV REDIS_URL=redis://redis:6379
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ssm_pay?schema=public

# Start the application using Node.js directly for better signal handling
CMD ["node", "server.js"]

# =============================================================================
# Build Arguments (optional overrides)
# =============================================================================
# ARG NODE_VERSION=20
# ARG NEXTJS_VERSION=14
# 
# Usage:
#   docker build --build-arg NODE_VERSION=20 .
#
# Image Labels
LABEL maintainer="SSM-Pay Team"
LABEL org.opencontainers.image.title="SSM-Pay Payment Platform"
LABEL org.opencontainers.image.description="Production-ready payment platform container"
LABEL org.opencontainers.image.vendor="SSM-Pay"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.licenses="Proprietary"
