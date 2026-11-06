# LimeOnIt production image. Build:  docker build -t limeonit .
# Run with docker-compose.yml and a .env file — see docs/installatie-docker.md.
# Base image aligned with the Volta pin (package.json volta.node 24.x).

# better-sqlite3 downloads a prebuilt musl binary (linux x64 and arm64) during npm ci.
FROM node:24-alpine AS development-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# `npm run build` builds the app and the ops scripts (build/ops/*.js, scripts/ops.config.ts).
FROM node:24-alpine AS build-env
WORKDIR /app
COPY . .
COPY --from=development-dependencies-env /app/node_modules ./node_modules
RUN npm run build

# The final image holds only what runs: the build, production node_modules and the migrations.
# No TypeScript source, no tests, no dev tooling.
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/limeonit.db \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
# getDb() applies pending migrations on first connect, so a fresh volume is provisioned on
# boot; `node build/ops/migrate.js` runs the same migrator by hand.
COPY --from=build-env /app/drizzle ./drizzle
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["npm", "run", "start"]
