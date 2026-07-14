# ================================================================
# Stage 0: Builder image – base configuration
# ================================================================
FROM node:24-alpine AS base

RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

# Chỉ copy file package*.json (Bỏ việc COPY .npmrc thủ công)
COPY package*.json ./

# ================================================================
# Stage 1: Development
# ================================================================
FROM base AS development

ENV NODE_ENV=development

# Mount .npmrc tạm thời khi chạy npm install ở môi trường local
RUN --mount=type=secret,id=npmrc,target=.npmrc npm install

COPY . .

EXPOSE 50001

CMD ["npm", "run", "start:dev"]

# ================================================================
# Stage 2: Builder
# ================================================================
FROM base AS builder

# Mount file .npmrc từ Action truyền xuống thông qua Buildx để chạy npm ci
RUN --mount=type=secret,id=npmrc,target=.npmrc npm ci

COPY . .

RUN npm run build

# ================================================================
# Stage 3: Production image – minimal runtime image
# ================================================================
FROM node:24-alpine AS production

RUN addgroup --gid 1001 -S nodejs && \
    adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production

RUN apk add --no-cache --virtual .build-deps && \
    rm -rf /var/cache/apk/* && \
    apk del .build-deps && \
    rm -rf /tmp/* /var/tmp/*

EXPOSE 50001

USER nextjs
CMD ["node", "dist/main"]