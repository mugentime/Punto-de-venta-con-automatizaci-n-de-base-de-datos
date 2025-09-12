# Production-optimized Dockerfile for Railway deployment
# POS Conejo Negro - Multi-stage build for minimal size and maximum security

# Stage 1: Build dependencies and optimize
FROM node:18-alpine AS builder

# Set build arguments for cache optimization
ARG NODE_ENV=production
ARG BUILD_DATE
ARG COMMIT_SHA

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --only=production --no-audit --prefer-offline \
    && npm cache clean --force

# Stage 2: Production runtime
FROM node:18-alpine AS runtime

# Install runtime dependencies for POS system
RUN apk add --no-cache \
    postgresql-client \
    curl \
    bash \
    tzdata \
    dumb-init

# Create application user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S posapp -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code with proper permissions
COPY --chown=posapp:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p \
    /app/data \
    /app/logs \
    /app/uploads \
    /app/backups \
    /app/public \
    /app/storage && \
    chown -R posapp:nodejs /app

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=America/Mexico_City

# Add health check script
COPY --chown=posapp:nodejs scripts/healthcheck.sh /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

# Switch to non-root user
USER posapp

# Expose application port
EXPOSE 3000

# Add comprehensive health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/healthcheck.sh

# Add labels for monitoring and tracking
LABEL maintainer="POS Development Team" \
      version="1.0.0" \
      description="Point of Sale System - Conejo Negro Cafe" \
      build-date=${BUILD_DATE} \
      commit-sha=${COMMIT_SHA}

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application with optimized settings
CMD ["node", "--max-old-space-size=512", "--gc-interval=100", "server.js"]