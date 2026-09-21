FROM node:24-alpine AS deps

ARG APP_UID=1000
ARG APP_GID=1000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN chown -R "${APP_UID}:${APP_GID}" /app

# 
# Development must run with the host developer's UID/GID so that the bind-mounted
# source tree under /app is writable by the container process. Production must
# keep a fixed non-root UID/GID and must not depend on the host developer identity.
#
FROM deps AS development

ENV NODE_ENV=development

COPY --chown=${APP_UID}:${APP_GID} . .

USER ${APP_UID}:${APP_GID}

EXPOSE 50001

CMD ["npm", "run", "start:dev"]

FROM deps AS builder

COPY --chown=${APP_UID}:${APP_GID} . .
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

USER app

EXPOSE 50001

CMD ["node", "dist/main"]
