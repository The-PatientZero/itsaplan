# ── Elysia API (Bun) — built from the monorepo root ──
# build context in docker-compose = repository root (.)
FROM oven/bun:1.4.0-alpine AS base
WORKDIR /app

# 1) Install dependencies from manifests (cacheable layer). All workspace
# manifests are copied — `bun install --frozen-lockfile` validates the whole
# workspace against bun.lock, so a missing member (e.g. web) fails the install.
FROM base AS install
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/bot/package.json ./apps/bot/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/agent-tools/package.json ./packages/agent-tools/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/mailer/package.json ./packages/mailer/
COPY packages/net/package.json ./packages/net/
COPY packages/runner/package.json ./packages/runner/
COPY packages/eslint-config/package.json ./packages/eslint-config/
# INSTALL_FILTER installs only the api workspace and its dependency closure, so the
# image excludes every other app's deps. INSTALL_FLAGS defaults to --production; the
# test gate overrides both — it runs the bot and worker suites out of this image, and
# those need their own workspace links and the devDeps the suites import.
ARG INSTALL_FILTER="--filter api"
ARG INSTALL_FLAGS="--production"
RUN bun install --frozen-lockfile $INSTALL_FILTER $INSTALL_FLAGS

# 2) Final image. bun keeps some workspace deps in per-package node_modules
# (packages/db/node_modules, apps/api/node_modules) rather than hoisting them to
# the root, so copy the whole install tree (manifests + every node_modules), then
# overlay the source. .dockerignore excludes node_modules, so `COPY . .` does not
# clobber the copied dependencies.
FROM base AS release
ENV NODE_ENV=production
# pg_dump, for the backup migrate.ts takes before it applies anything. A client older
# than the server refuses to dump, so the PostgreSQL 18 client comes from the next
# Alpine branch; it dumps the 17 the compose file runs as well.
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/v3.23/main postgresql18-client \
  && mkdir /backups && chown bun:bun /backups
COPY --from=install /app ./
COPY . .

# Runs as a non-root user on a filesystem that may be read-only. The only paths it
# writes are /tmp and /backups (the pre-migration dump, or SKIP_PRE_MIGRATION_BACKUP=1).
# A backups volume created by an earlier root image stays root-owned and needs a
# one-time `chown 1000` before this image can dump into it. The transpiler cache would
# write under $HOME, so it is off.
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
USER bun

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health/live || exit 1
# Apply migrations before starting the server. A platform that runs migrations as a
# separate step starts the server alone with `bun run apps/api/src/index.ts` and runs
# `bun run packages/db/src/migrate.ts` from the same image.
CMD ["sh", "-c", "bun run packages/db/src/migrate.ts && bun run apps/api/src/index.ts"]
