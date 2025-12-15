# Build stage
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy files
COPY package.json bun.lockb ./
COPY src ./src
COPY tsconfig.json biome.json ./

# Install dependencies and build
RUN bun install --production
RUN bun run build

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --eval "import('http').then(({request}) => request('http://localhost:3000/health').then(r => r.status === 200 ? process.exit(0) : process.exit(1)))" || exit 1

# Expose port
EXPOSE 3000

# Run application
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["bun", "dist/index.js"]
