# ================================================================
# Stage 1: base — dependencies chung cho tất cả các stage
# ================================================================
FROM node:24-alpine AS base

WORKDIR /app

# Copy package files riêng để tận dụng Docker layer caching
COPY package*.json ./

# ================================================================
# Stage 2: development — hot-reload cho local dev
# ================================================================
FROM base AS development

# Cài đặt cả dependencies và devDependencies
RUN npm ci

# Copy toàn bộ source code (hoặc dùng volume mount ở compose)
COPY . .

# Expose port đã khai báo trong .env [5]
EXPOSE 3001

# Dùng script start:dev (nest start --watch) để auto-reload khi code thay đổi [4]
CMD ["npm", "run", "start:dev"]

# ================================================================
# Stage 3: build — biên dịch TypeScript sang JavaScript
# ================================================================
FROM base AS build

RUN npm ci

COPY . .

# nest build -> output vào thư mục dist [4]
RUN npm run build

# ================================================================
# Stage 4: production — image tối giản, chỉ chạy dist
# ================================================================
FROM node:24-alpine AS production

WORKDIR /app

# Copy artifact từ stage build
COPY --from=build /app/dist ./dist

# Chỉ copy production dependencies (tiết kiệm dung lượng)
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/package.json ./

ENV NODE_ENV=production

EXPOSE 3001

# Chạy compiled JS [3][4]
CMD ["node", "dist/main"]