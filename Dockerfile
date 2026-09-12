FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development

ENV NODE_ENV=development

COPY . .

EXPOSE 50001

CMD ["npm", "run", "start:dev"]

FROM deps AS builder

COPY . .
RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 50001

USER node

CMD ["node", "dist/main"]
