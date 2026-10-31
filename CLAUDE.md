<!-- Copied from the box in docs/team/03-claude-prompt-guide.md (Part 1). Change both together. -->

# Rules for Claude

You work on a direct-booking website for Lebanese guesthouses. Tools: Next.js 16 (App Router), TypeScript in strict
mode, Prisma with PostgreSQL, Better Auth, Zod 4, next-intl, Tailwind 4, Vitest.

Follow these rules exactly. If a rule and your habit are different, follow the rule. If something is not covered,
ask. Do not invent a new way.

## Read first

At the start of every session, read `README.md` and every Markdown file in `docs/` (all `docs/**/*.md`). Read them
fully, not only the titles. They explain the whole project: what it does, how it is built, who works on what, and
how to test it. They are the source of truth. If the code and a document disagree, say so. Do not guess.

- `docs/team/README.md`: how we work together: the database keeper, backend first, the shared files, and how we
  use GitHub. Who builds what is decided by the team outside these documents: never create or change a file that
  someone else is working on.
- `docs/team/02-architecture-and-features.md`: how each feature works and how the code is built.
- `docs/team/03-claude-prompt-guide.md`: how tasks are written for you, and how to report.
- `docs/team/04-test-plan.md`: which tests each feature needs, and how to write them.
- `docs/team/05-project-structure.md`: all folders and files, and where new files go.
- `docs/team/06-functional-requirements.md`: what the new project does (the three booking modes, must have and
  bonus). It wins over `docs/functional-requirements.md` when they disagree.
- `docs/team/07-data-model.md`: the database rules, and what changed from the reference project (already applied
  in `prisma/schema.prisma`, the migration `20261030000000_three_booking_modes` and `docs/erd.md`).
- `docs/team/08-design-system-and-pages.md`: the colours, fonts, spacing, shared components, and every page with
  its sections. Every screen follows it exactly.
- `docs/architecture.md`, `docs/data-model.md`, `docs/functional-requirements.md`,
  `docs/non-functional-requirements.md`, `docs/requirements-matrix.md`: the requirements and the design.
- `docs/erd.md`, `docs/erd-platform.md`, `docs/erd-ai-mcp.md`: made from the schema by `pnpm docs`. Read them for
  the exact tables; `docs/erd-explained.md` says what each table means. Never edit the generated ERDs by hand.
- `docs/openapi.json` (and `docs/openapi.yaml`, made from it by `pnpm docs`): the API contract. Build routes to
  match it. Never edit the YAML by hand.
- `docs/scope-lock.md` and `docs/Ready for Business Demo-Ready Standard and Scope Lock.pdf`: what we promised for
  Demo Day and what "demo-ready" means. Never build anything on the scope's cut list, and never add a feature that
  is not in the scope (that needs Sami's approval).

Then read the existing file that is closest to what you are building. Copy its style: names, comments, structure.
If that file does not exist yet in this repository, read the matching file of the reference project
(`se-next-stays`), which follows every rule here, but apply the new project's rules (`06` and `07`) over its older
ones: three booking modes, full refunds, payments online only, no Kazderni.

## The layers (never break them)

- Routes and pages (`src/app/**`): read the input, check it with a schema from `src/server/validation/schemas.ts`,
  call ONE service function, and answer. No business rules. No database. Never import `@/server/repositories/*` or
  `@/server/db/*`.
- Wrap every API route: `route(handler)` for public routes, `tenantRoute(paramsSchema, handler)` for
  `/api/workspaces/[businessId]/**`. Use `parseBody`, `parseQuery`, `parseParams` and `json`. Never call
  `request.json()` yourself.
- Services (`src/server/services/<area>-service.ts`) hold every rule. Order: `requirePermission(ctx, "...")` first,
  then business checks, then repository calls. Use `runInTransaction` for changes that go together, `recordAction`
  for the audit log, and a job (`defineJob` in `src/server/jobs/queue.ts`) for notifications. Services are plain exported functions. When they work in a
  business, `ctx: TenantContext` is the first argument.
- Repositories (`src/server/repositories/<area>-repository.ts`) are the only code that queries the database. The
  first argument is `db: Db` (or `tx: Tx` inside a transaction). Every business query filters by `businessId`. No
  permission checks. No decisions.
- Only the database keeper (named in `docs/team/README.md`) changes `prisma/schema.prisma` and
  `prisma/migrations/`. If the task needs a database change, stop and
  say so.

## Rules for clean code

- Errors: throw `notFound`, `forbidden`, `conflict`, `invalid`, `unavailable` or `unauthenticated` from
  `src/server/errors.ts`. Write messages a guest or a host understands.
- Database refusals: wrap the write with `overlapAsConflict(message, write)` or `duplicateAsConflict(message, write)`
  from `src/server/services/constraint-errors.ts`. Never write your own try/catch for `23P01` or `P2002`.
- Lists of values (statuses, methods, plans, kinds, scopes) come from `src/config/*.ts`. Never type
  `"HELD" | "CONFIRMED"` or `["PRO", "BUSINESS"]` by hand. Add new lists there, checked with `satisfies` against the
  Prisma enum.
- Raw SQL only through Prisma's `$queryRaw` template, with values as `${value}` placeholders. Never `$queryRawUnsafe`.
  Never build SQL by joining strings.
- Money is whole minor units (`...Cents`: 9999 means 99.99), stored as `BigInt` and read as a plain `number`
  through the client's `moneyAsNumbers` extension (`src/server/db/client.ts`). Never use `Decimal`, `Float` or
  `Int` for money. When you use a generated Prisma type with money, wrap it: `MoneyAsNumbers<Booking>`
  (`src/lib/money.ts`). In raw SQL, sum money as `::bigint` and read it with `moneyNumber()`, never `::int`. A new
  money column also needs a line in `moneyAsNumbers`.
- A booking is always paid in full. There are no deposits; never add a deposit field, setting or screen.
- Plans are paid instantly only (Stripe or Whish). Never build paying by hand, receipt uploads or an approval step.
- One fact, one place: never add a field that can contradict another. The refund rule is the only cancellation
  rule shown. The numbers guests see are the business's (`Business.whatsapp`, `phone`), never a host profile's.
  Reviews have one overall rating.
- Rate limits: `enforceRateLimit(key, limit, windowMs)` from `src/server/http/rate-limit.ts`. It counts in Redis
  (memory in tests). Never add a rate-limit table.
- Calendar clashes: a platform booking over our nights is kept as an active `IMPORTED` row with `conflict = true`;
  never cancel it, delete it, mark it inactive or move it to another table. Code that frees or takes our own nights
  (decisions, cancellations, expiries, closed dates) calls `recheckImportClashes(businessId, roomId)` after it
  commits.
- Nights are ISO dates, or `DateRange { checkIn, checkOut }` from `src/lib/dates.ts`. The check-out night is free.
- All or nothing: every database step of one change goes in one `runInTransaction`, and nothing inside catches an
  error to carry on, so a failed step undoes the steps before it. Never call Stripe, Whish, R2 or email inside the
  transaction: write our row first, call after the commit, and undo an upload whose row was not saved. Each such
  service has an integration test that makes a later step fail and finds nothing left (`02` Part 3, "All or
  nothing").
- A feature is built backend first: its API pull request (routes, `docs/openapi.json`, tests, checked by hand in
  Postman or Swagger) is merged before its screens pull request (`docs/team/README.md`).
- Small side writes (logs, usage, "last used") go in `inBackground(label, work)` from `src/server/background.ts`.
  Slow or must-happen work (AI answers, emails, push, scheduled jobs) is a job: `defineJob(queue, kind, handler)`,
  with its module listed in `src/server/jobs/registry.ts`. Job data holds ids and plain values only, never a
  `TenantContext`. An AI route calls `runOrQueue(job, data, estimateSeconds)` and answers with `jobResponse`; the
  screen calls `api.run`. Never await slow work on the request path.
- Functions that depend on the time take `now = new Date()` as the last argument, so tests can set the time.
- Settings come from `env` (`src/server/env.ts`), never `process.env`. A new setting is declared there, explained in
  `.env.example`, and added to `docker-compose.prod.yml` if production needs it.
- A new bell entry needs four things: the log call, the action in `notification-feed-service.ts`, an icon (and link)
  in `notification-list.tsx`, and its text in the three message files. A new email or push is a `notify` job built
  like `notifyImportConflict` in `notification-service.ts`.
- Booking needs an account: public booking routes call `requireUser(request)` first.
- No repeated code. Before you write a helper, search for one in `src/lib`, `src/hooks`, `src/components/ui` and
  `src/config`. If two places need the same logic, put it in one shared place.
- Names say what things are. For example `createBooking`, not `createHeldBooking` if it also creates confirmed
  bookings. No short forms, except common ones (id, url, ctx, tx, db).
- Comments explain why, not what, in the same calm style as the existing code. No commented-out code. No TODOs.
- Never write temporary code: no placeholders, no fake versions, no "for now" shortcuts, no sample data inside
  the app's code. Everything you write is the final version.
- One planned exception: the Whish simulator (`WHISH_MODE=simulator`). We have no Whish merchant account yet. The
  simulator is a permanent mode of the Whish client that follows Whish's real API (version 1.4.4), so switching to
  real Whish (`WHISH_MODE=sandbox` or `production`) needs only the keys, never a code change. Build it like the
  reference project, not as a quick fake.
- If you need something from another person's task that is not merged yet, build the parts that do not need it,
  and say in your report what is left to connect. Never edit their files, and never write a fake version of it.
- No `any`, no `as unknown as`, no `@ts-ignore`, no `eslint-disable`, unless there is truly no other way. Then write
  why.

## Rules for screens

- Before building or changing a screen, read its entry in `docs/team/08-design-system-and-pages.md` (Part 8) and
  build its sections in that order, with the containers, text sizes and components that file names. Finish with
  its checklist (Part 9).
- The design is fixed. Use the same themes (five palettes, light and dark), tokens, components, layouts and
  interactions as the reference project. Never add new colours, fonts, spacing or component styles. Build new screens
  from the existing pieces, so they look like the screens around them.
- Use server components by default. Add `"use client"` only for state, effects or click handlers.
- Pages read data through services, with `requirePageTenant` or `requirePageAccess` (`src/server/http/session.ts`).
- In the browser, call the API with `api` from `src/lib/api-client.ts`. Show errors with
  `errorMessage(caught, fallback)` and `<FormError message={error} />`.
- Hooks: `useAction` (call, then refresh), `useRedirectAction` (call, then go to another page), `useStoredChoice`
  (remember a choice in this browser), `useConfirm` (before anything that cannot be undone).
- Tokens only: `bg-surface`, `text-muted`, `ring-line`, `bg-accent text-accent-ink`, `bg-danger text-danger-ink`,
  `backdrop:bg-scrim`. Never hex colours, `bg-[#...]`, `text-white` on a token colour, or Tailwind's default colours
  such as `bg-gray-100`.
- Reuse `src/components/ui/`: `Button`, `ButtonLink`, `Field`, `TextArea`, `LabeledControl`, `FormError`,
  `SheetDialog`, `Skeleton`, `PageHeader`, `Panel`, and `inputClass`, `panelClass`, `choiceChipClass`.
- Every screen works at 390 pixels wide with no sideways scrolling, in English and Arabic (right-to-left).
- Every text on screen goes in `messages/en.json` and `messages/ar.json` (and `ar-LB.json` if it exists), with the
  same key.
- Every dashboard page has a `loading.tsx` and an empty state.

## Rules for the database

- Only the database keeper (named in `docs/team/README.md`) changes `prisma/schema.prisma` and
  `prisma/migrations/`. If your task needs a database change, stop
  and say exactly what you need.
- Nothing is deleted: business tables have `isDeleted`. Delete with an update, filter `isDeleted: false` in every
  read, and bring a deleted row back instead of creating a duplicate (see `createCategory` in
  `admin-repository.ts`). Only sessions, tokens, job progress and push devices are really deleted.
- Money is `BigInt` minor units, read as numbers (see "Rules for clean code").
- When a unique key exists, save with `upsert` on it instead of delete-then-create.
- Anything that changes a room's nights runs in `runInTransaction` with `lockActiveRoom` first.
- Raw SQL in a migration for what Prisma cannot express (EXCLUDE, CHECK, triggers, data moves). A new rule that old
  rows break is added `NOT VALID`. A migration that drops a column first moves any data worth keeping. Never edit a
  merged migration.
- After any schema change: `pnpm exec prisma generate`, `pnpm docs` (ERDs and API contract), and update
  `docs/team/07-data-model.md` (and `docs/erd-explained.md` if a table's meaning changed).

## Rules for the AI

- An AI tool is `defineTool({ name, description, input: z.object(...), requires, mutates, run })` in
  `src/server/ai/team-tools.ts` (owners) or `guest-tools.ts` (guests). `run` calls an existing service with the
  context. Tools never take a `businessId` and never query the database.
- Tools that change data have `mutates: true`. In the dashboard chat, the person confirms them. The model never runs
  them directly.
- Wrap text written by guests with `guestWritten(text)`.

## Before you say a task is done

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, `pnpm test`, and the integration tests for the
   feature (`pnpm exec vitest run --project integration tests/integration/<file>.test.ts`). Run them one at a time.
   Never run them next to `pnpm dev` on a small computer.
2. If you added or changed an API route, write it in `docs/openapi.json` to match its Zod schema (once
   `scripts/openapi.ts` exists, add it there instead: it generates the file) and run `pnpm docs` (it also writes `docs/openapi.yaml`).
3. Every new text is in `messages/en.json`, `ar.json` and `ar-LB.json` (Lebanese Arabic, spoken style). A key you
   stopped using is removed from all three.
4. If you changed how something works (a rule, a flow, a table, a setting), update the matching file in
   `docs/team/` and `docs/` in the same pull request. These files are how the next person, and you in the next
   session, know what to do. A change the documents do not describe is not finished.
5. If `pnpm typecheck` reports an error in a file you did not touch, or about a key that exists, run
   `pnpm exec tsc --noEmit --incremental false` once: the build cache in `tsconfig.tsbuildinfo` can be stale.
6. Report exactly: what you changed, which checks you ran and their results, and anything you could not do. Never say
   a check passed if you did not run it.
