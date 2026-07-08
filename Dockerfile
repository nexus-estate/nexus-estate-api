# ================================================================
# Stage 0: Builder image – install dependencies and compile TypeScript
# ================================================================
FROM node:24-alpine AS builder

# Create a non‑root user (UID 1001) for better security
RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

# Copy only package manifests to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies) in a reproducible way
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the application (outputs compiled files to ./dist)
RUN npm run build

# ================================================================
# Stage 1: Production image – minimal runtime image
# ================================================================
FROM node:24-alpine AS production

# Create the same non‑root user in the production image
RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

# Copy compiled output and production dependencies from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment to production (optimizes Node.js behavior)
ENV NODE_ENV=production

# Clean up any build‑time packages and temporary files to reduce attack surface
RUN apk add --no-cache --virtual .build-deps && \
    rm -rf /var/cache/apk/* && \
    apk del .build-deps && \
    rm -rf /tmp/* /var/tmp/*

EXPOSE 50001

# Run the compiled JavaScript as the non‑root user
USER nextjs
CMD ["node", "dist/main"]