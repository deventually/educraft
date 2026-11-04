# Base image aligned with the Volta pin (package.json volta.node 24.x).
FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
# The drizzle migrations must ship in the image: getDb() applies any pending
# migration on first connect (boot-time migration, see app/server/db.server.ts),
# so a fresh volume (DATABASE_URL=file:/data/limeonit.db) is provisioned on boot.
COPY --from=build-env /app/drizzle /app/drizzle
WORKDIR /app
# Migrations run automatically on the first DB access (boot-time). Production
# mounts a persistent volume at /data — see wiki/Deployment.md.
CMD ["npm", "run", "start"]
