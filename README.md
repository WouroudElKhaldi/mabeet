# Mabeet · تفضّل

Direct bookings for Lebanese guesthouses and B&Bs: guests book on the host's own page, paid online in full or
arranged with the host, with one calendar that stays in sync with Booking.com and Airbnb. Hosts stop paying the 15 to
18% platform commission on direct guests, stop losing requests in DMs, and are never double-booked.

> **The headline guarantee:** the database itself refuses a double booking (an `EXCLUDE` constraint on taken
> nights). A test sends 20 requests for the last free room at the same moment, and exactly one gets it.

This repository is the team rebuild for Demo Day (Saturday 21 November). It starts from the setup only: the tools, the
whole database, and the documents. Every feature is written in [docs/team/06-functional-requirements.md](docs/team/06-functional-requirements.md),
and how we work together in [docs/team/README.md](docs/team/README.md).

## Who it's for

- **Guests** find a stay, book it, pay online (Whish or a card) or arrange it with the host, follow the booking,
  see things to do near their stay, and can ask their own AI app (Claude, ChatGPT) about places through our MCP.
- **Hosts** run rooms or a whole place, one shared calendar, bookings and decisions, analytics with the commission
  saved, payouts and their team, and can connect their own AI app (MCP) to read their bookings and figures.
- **Staff** see and do only what their role allows, on the screens and through the AI.
- **Platform admins** send payouts, watch the platform, and can suspend a business.

English, Arabic and Lebanese Arabic, right to left included, designed for phones first.

### The three booking modes

| Mode                      | The guest pays                          | Who confirms                    |
| ------------------------- | --------------------------------------- | ------------------------------- |
| **Automatic**             | Online, the full amount (Whish or card) | Nobody: the payment confirms it |
| **Online, with approval** | Online, the full amount (Whish or card) | The owner confirms or declines  |
| **Offline**               | Arranged with the host, not through us  | The owner confirms or declines  |

Online payments are always for the full amount (no deposits) and every refund is full and automatic. Unpaid bookings
end after 10 minutes and free the room. Mabeet takes no commission: it earns only from host plans and sponsored listings.

## Tools

Next.js 16 (App Router) · TypeScript (strict) · Tailwind 4 · Prisma 6 and PostgreSQL 17 · Redis (rate limits) ·
Better Auth · Zod 4 · next-intl · pg-boss (queues and the worker) · MCP · DeepSeek (AI, last bonus) · Stripe (test mode) and Whish
(built-in simulator until merchant keys) · Resend (email) · Web Push · iCal import and export · Vitest and Playwright ·
Docker on DigitalOcean, deployed by GitHub Actions.

## Run it on your computer

### With Docker (recommended: nothing else to install)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then:

```bash
docker compose up
```

The first start takes a few minutes. It downloads Postgres and Redis, installs every library, creates every table
(and the test database), and starts the website on http://localhost:3000. Saving a file reloads the page. Next
starts take seconds: the database and the libraries are kept in Docker volumes.

| Command                                         | What it does                                                  |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `docker compose up`                             | Starts everything (add `-d` to run it in the background)      |
| `docker compose down`                           | Stops it; the database and libraries are kept                 |
| `docker compose down -v`                        | Stops it and deletes the database and libraries (fresh start) |
| `docker compose run --rm setup`                 | After pulling a new library or migration: install and migrate |
| `docker compose exec app pnpm check`            | Any pnpm command, inside the running app                      |
| `docker compose exec app pnpm test:integration` | The integration tests, on the test database                   |
| `docker compose logs -f app`                    | The website's log                                             |

No `.env` is needed to start. Copy `.env.example` to `.env` only to add keys (DeepSeek, Stripe, Resend...). Inside
Docker the database and Redis addresses always point at Docker's own services, whatever `.env` says. Postgres is also
open on `localhost:5433` (user and password `tafaddal`) for Prisma Studio or any database tool.

**The production shape** (the built image, the worker, Postgres and Redis, as on DigitalOcean) runs with
`docker compose -f docker-compose.prod.yml up --build`.

### Without Docker

You need Node 22.12 or newer and pnpm (`npm install -g pnpm`). You don't need to install Postgres.

```bash
pnpm install
cp .env.example .env        # then fill in the values (each one is explained in the file)
pnpm db:start               # the project's own Postgres, stored in .pgdata; leave this terminal open
pnpm db:deploy              # creates every table
pnpm dev                    # http://localhost:3000
```

## Settings (`.env`)

Every setting is in [.env.example](.env.example), grouped and explained. To start, only the database URLs,
`BETTER_AUTH_SECRET` and `CRON_SECRET` are needed. Without the others the app still runs: emails are printed to the
log, Whish runs on its simulator, rate limits count in memory, push is off, and photos are kept in Postgres. The live site
stores photos in Cloudflare R2 (free tier). Live values go in DigitalOcean's
settings and GitHub secrets, never in the repository.

## Useful commands

| Command                 | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`              | The website on http://localhost:3000                                            |
| `pnpm check`            | Types, lint, formatting, unused code (knip) and unit tests: run before every PR |
| `pnpm test:integration` | Integration tests on the test database                                          |
| `pnpm db:start`         | The local Postgres (no install)                                                 |
| `pnpm db:deploy`        | Applies every migration                                                         |
| `pnpm db:migrate`       | Creates a new migration (the database keeper only)                              |
| `pnpm db:studio`        | Browse the database                                                             |
| `pnpm docs`             | Regenerates the ERDs from the schema and `docs/openapi.yaml` from the JSON      |

Later tasks add `pnpm worker`, `pnpm db:seed` and `pnpm test:e2e`.

## The database

`prisma/schema.prisma` already has every table, for every feature including the bonus ones (47 tables). The
migrations build it from an empty database: the reference project's migrations, with the hand-written rules Prisma
cannot express (the no-overlap `EXCLUDE` constraint, the seat triggers, the CHECK rules on money), then
`20261030000000_three_booking_modes`, which applies the new project's rules
([docs/team/07-data-model.md](docs/team/07-data-model.md)). Only the database keeper changes them.

## Documents

| Document                                                                                                  | What it says                                         |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [docs/team/README.md](docs/team/README.md)                                                                | Start here: how we work, reading order, glossary     |
| [docs/scope-lock.md](docs/scope-lock.md)                                                                  | The scope locked with Sami: core flow, cut list      |
| [Demo-ready standard (PDF)](docs/Ready%20for%20Business%20Demo-Ready%20Standard%20and%20Scope%20Lock.pdf) | What "demo-ready" means                              |
| [docs/functional-requirements.md](docs/functional-requirements.md)                                        | What it does (must have and bonus)                   |
| [docs/non-functional-requirements.md](docs/non-functional-requirements.md)                                | How well, and how we prove it                        |
| [docs/requirements-matrix.md](docs/requirements-matrix.md)                                                | Each requirement, its code and its test              |
| [docs/architecture.md](docs/architecture.md)                                                              | Layers, the booking race, sync, queues, payments, AI |
| [docs/data-model.md](docs/data-model.md), [docs/erd-explained.md](docs/erd-explained.md)                  | The data model, table by table                       |
| [docs/erd.md](docs/erd.md), [platform](docs/erd-platform.md), [AI and MCP](docs/erd-ai-mcp.md)            | Diagrams made from the schema (`pnpm docs`)          |
| [docs/openapi.json](docs/openapi.json), [docs/openapi.yaml](docs/openapi.yaml)                            | The API contract, in JSON and YAML                   |
| [CLAUDE.md](CLAUDE.md) and [.claude/skills/](.claude/skills)                                              | The rules and skills Claude Code follows here        |

## Working with Claude

Claude Code reads [CLAUDE.md](CLAUDE.md) in every session, and loads the skills in `.claude/skills/` when the work
needs them: `tafaddal-task` (build a feature by its requirement id), `tafaddal-architecture`, `tafaddal-screens`,
`tafaddal-database`, `tafaddal-tests`, `tafaddal-review` and `tafaddal-scope`. Ask for one feature per conversation, for
example: "Build rooms, prices and photos (F7), the API first." The prompt template is in
[docs/team/03-claude-prompt-guide.md](docs/team/03-claude-prompt-guide.md).
