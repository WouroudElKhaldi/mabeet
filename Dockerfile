# One image, two processes: the website (`pnpm start`) and the job worker (`pnpm worker`, added with the queues
# task). DigitalOcean runs it twice with a different command; docker-compose.prod.yml shows the pair. The
# `base` stage is also what docker-compose.yml (development) runs the code in. pg-boss needs
# Node 22.12 or later.
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# pnpm comes from package.json's packageManager, downloaded by corepack without asking.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

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
# The worker runs TypeScript through tsx, so the full node_modules (with dev tools) stays in the image.
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
