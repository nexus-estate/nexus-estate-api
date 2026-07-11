# ================================================================
# Stage 0: Base
# ================================================================
FROM node:24-alpine AS base

RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

COPY package*.json ./

# ================================================================
# Stage 1: Development
# ================================================================
FROM base AS development

ENV NODE_ENV=development

RUN npm install

COPY . .

EXPOSE 50001

CMD ["npm", "run", "start:dev"]

# ================================================================
# Stage 2: Builder
# ================================================================
FROM base AS builder

RUN npm ci

COPY . .

RUN npm run build

# ================================================================
# Stage 3: Production
# ================================================================
FROM node:24-alpine AS production

RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 50001

USER nextjs

CMD ["node", "dist/main"]