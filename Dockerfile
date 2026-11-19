# syntax=docker/dockerfile:1
# Life Reset — standalone Bun app (React client + ./actions RPC + SQLite).
# Build the client bundle, then run the server. The SQLite file lives on the
# Render persistent disk mounted at /data (see render.yaml).
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY client ./client
COPY server ./server
COPY migrations ./migrations
RUN bun run client/build.mjs

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/app.db
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server ./server
COPY --from=build /app/migrations ./migrations
EXPOSE 3000
CMD ["bun", "run", "server/src/server.ts"]
