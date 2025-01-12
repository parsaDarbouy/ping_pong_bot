# Build stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts

# Compile contracts and ensure artifacts directory exists
RUN npm run compile || true && \
    mkdir -p artifacts/contracts

# Clean up unnecessary files
RUN npm prune --production && \
    rm -rf /root/.npm /root/.node-gyp /tmp/*

FROM node:18-alpine AS production

RUN apk add --no-cache tini && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

WORKDIR /app

# Copy only essential files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/artifacts ./artifacts
COPY --from=builder /app/hardhat.config.js ./

# Set permissions and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx hardhat run scripts/ping_pong.js --network ${NETWORK:-sepolia}"]

LABEL maintainer="Parssa darbouy <parsadarbouy@gmail.com>" \
      description="Ethereum Ping-Pong Service" \
      version="1.0.0"
