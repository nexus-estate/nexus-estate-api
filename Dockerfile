FROM node:24-alpine AS deps

ARG APP_UID=1001
ARG APP_GID=1001

RUN addgroup --system --gid "${APP_GID}" app \
  && adduser --system --disabled-password --uid "${APP_UID}" --ingroup app app

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN chown -R app:app /app

FROM deps AS development

ENV NODE_ENV=development

COPY --chown=app:app . .

USER app

EXPOSE 50001

CMD ["npm", "run", "start:dev"]

FROM deps AS builder

COPY --chown=app:app . .
RUN npm run build

FROM node:24-alpine AS production

ARG APP_UID=1001
ARG APP_GID=1001

RUN addgroup --system --gid "${APP_GID}" app \
  && adduser --system --disabled-password --uid "${APP_UID}" --ingroup app app

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=app:app /app/dist ./dist
RUN chown -R app:app /app

EXPOSE 50001

USER app

CMD ["node", "dist/main"]
