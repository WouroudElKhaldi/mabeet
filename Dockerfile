# One image, two processes: the website (`pnpm start`) and the job worker (`pnpm worker`, added with the queues
# task). The live server runs it through docker-compose.prod.yml, once per process with a different command, and once
# more to apply the migrations (docs/deployment.md). The `base` stage is also what docker-compose.yml (development)
# runs the code in. pg-boss needs Node 22.12 or later.
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# pnpm comes from package.json's packageManager, downloaded by corepack without asking. It is downloaded here, into a
# shared folder rather than root's home, so every stage has it and the `node` user that runs the image never
# downloads it again when a container starts. pnpm fetches its own native program the first time it runs, into the
# same folder: `pnpm --version` does that now.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN corepack install && pnpm --version

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Not a secret: the public address of the R2 photo bucket, which next.config.ts allows for <Image> at build time.
ARG R2_PUBLIC_URL=""
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL
# The build reads no secrets; these placeholders only satisfy the env check at build time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret-xx" \
    BETTER_AUTH_URL="http://localhost:3000" \
    CRON_SECRET="build-time-placeholder-not-a-secret" \
    pnpm build

FROM base AS runtime
ENV NODE_ENV=production JOBS_MODE=queue
# The worker runs TypeScript through tsx, so the full node_modules (with dev tools) stays in the image. Owned by
# `node`, so Next.js can write its image cache and one-off scripts (`pnpm admins:create`) can write their files.
COPY --from=build --chown=node:node /app ./
RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
