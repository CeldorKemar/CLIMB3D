# One web service plus a managed PostgreSQL database; no Kubernetes or microservice fleet.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/editor-core/package.json ./packages/editor-core/package.json
COPY packages/geometry/package.json ./packages/geometry/package.json
# Optional trust certificate for corporate/cloud TLS proxies; verification stays enabled.
RUN --mount=type=secret,id=climbed_ca,target=/run/secrets/climbed_ca \
    if [ -s /run/secrets/climbed_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/climbed_ca; fi; \
    npm ci --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000
COPY packages ./packages
COPY apps ./apps
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/packages ./packages
USER node
EXPOSE 3001
CMD ["npm", "start"]
