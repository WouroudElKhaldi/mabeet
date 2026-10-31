# Working with Claude

Claude writes good code when it knows three things:

1. the rules,
2. which existing file to copy the style from,
3. what "done" means.

If it does not know them, it guesses. Guessing creates repeated code, files in the wrong place, and code with no
tests.

This file gives you two tools:

1. **A `CLAUDE.md` file** for the root of the repository. Claude Code reads it at the start of every session. So
   the rules apply to every task, and nobody has to paste them.
2. **A prompt template** to fill for each task, with an explanation of each part and full examples.

---

## Part 1. The CLAUDE.md file

### What it is

- A file named `CLAUDE.md` at the root of the repository.
- Claude Code reads it automatically in every conversation in this repository.
- Copy the content below into it, and commit it.
- If a rule changes, change the file in a normal pull request.

### The file (copy everything inside the box)

```markdown
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
- `docs/erd.md`, `docs/erd-platform.md`, `docs/erd-ai-mcp.md`: made from the schema by `pnpm run docs`. Read them for
  the exact tables; `docs/erd-explained.md` says what each table means. Never edit the generated ERDs by hand.
- `docs/openapi.json` (and `docs/openapi.yaml`, made from it by `pnpm run docs`): the API contract. Build routes to
  match it. Never edit the YAML by hand.
- `docs/scope-lock.md` and `docs/Ready for Business Demo-Ready Standard and Scope Lock.pdf`: what we promised for
  Demo Day and what "demo-ready" means. Never build anything on the scope's cut list, and never add a feature that
  is not in the scope (that needs Sami's approval).

Then read the existing file that is closest to what you are building. Copy its style: names, comments, structure.
If that file does not exist yet in this repository, read the matching file of the reference project
(`se-next-stays`), which follows every rule here, but apply the new project's rules (`06` and `07`) over its older
ones: three booking modes, full refunds, payments online only, no Kazderni.

## The modules and the layers (never break them)

The app is a modular monolith: one Next.js app, one database, split into feature modules
(`docs/team/05-project-structure.md` lists them and what each owns).

- A feature lives in one module, `src/modules/<name>/`: `server/` (its services, repositories, jobs and
  notifications), `schemas.ts` (its Zod input checks), `components/` and `hooks/` (its screens), `tests/`.
- A module has two doors and nothing else is imported from outside it: `@/modules/<name>` (`index.ts`: input checks,
  types and screens, safe in the browser) and `@/modules/<name>/server` (`server.ts`: the services other code may
  call). Its repositories are private. Inside a module, files import each other by relative path. ESLint enforces
  this.
- A module calls another module only through its `server.ts`, never its repositories, and the modules never call each
  other in a circle. A change that must commit together across two modules passes `tx` to the other module's public
  function. Rules that must be one transaction stay in one module: availability, holds, closed dates and the night
  locks all live in `bookings`, so no double booking is checked and written in one place.
- The shared kernel, `src/server/` (env, errors, database client, auth and tenancy, HTTP wrappers, jobs, email), has
  no business rules and never imports a module. The one exception is `src/server/jobs/registry.ts`, where the
  worker is put together.
- Routes and pages (`src/app/**`): read the input, check it with a schema from the module's `index.ts` (shared pieces
  in `src/lib/schemas.ts`), call ONE service function from its `server.ts`, and answer. No business rules. No
  database. Never import a module's inner files or `@/server/db/*`.
- Wrap every API route: `route(handler)` for public routes, `tenantRoute(paramsSchema, handler)` for
  `/api/workspaces/[businessId]/**`. Use `parseBody`, `parseQuery`, `parseParams` and `json`. Never call
  `request.json()` yourself.
- Services (`src/modules/<name>/server/<area>-service.ts`) hold every rule. Order: `requirePermission(ctx, "...")`
  first, then business checks, then repository calls. Use `runInTransaction` for changes that go together,
  `recordAction` (from `@/modules/audit/server`) for the audit log, and a job (`defineJob` in
  `src/server/jobs/queue.ts`) for notifications. Services are plain exported functions. When they work in a
  business, `ctx: TenantContext` is the first argument.
- Repositories (`src/modules/<name>/server/<area>-repository.ts`) are the only code that queries the database. The
  first argument is `db: Db` (or `tx: Tx` inside a transaction). Every business query filters by `businessId`. No
  permission checks. No decisions. A repository reads only its own module's tables; for another module's data, call
  that module's `server.ts`.
- Only the database keeper (named in `docs/team/README.md`) changes `prisma/schema.prisma` and
  `prisma/migrations/`. If the task needs a database change, stop and
  say so.

## Rules for clean code

- Errors: throw `notFound`, `forbidden`, `conflict`, `invalid`, `unavailable` or `unauthenticated` from
  `src/server/errors.ts`. Write messages a guest or a host understands.
- Database refusals: wrap the write with `overlapAsConflict(message, write)` or `duplicateAsConflict(message, write)`
  from `src/server/db/constraint-errors.ts`. Never write your own try/catch for `23P01` or `P2002`.
- Lists of values (statuses, methods, plans, kinds, scopes) come from `src/config/*.ts`. Never type
  `"HELD" | "CONFIRMED"` or `["PRO", "BUSINESS"]` by hand. Add new lists there, checked with `satisfies` against the
  Prisma enum.
- Raw SQL only through Prisma's `$queryRaw` template, with values as `${value}` placeholders. Never `$queryRawUnsafe`.
  Never build SQL by joining strings.
- Money is whole minor units (`...Cents`: 9999 means 99.99), stored as `BigInt` and read as a plain `number`
  through the client's `moneyAsNumbers` extension (`src/server/db/client.ts`). Never use `Decimal`, `Float` or
  `Int` for money. When you use a generated Prisma type with money, wrap it: `MoneyAsNumbers<Booking>`
  (`src/utils/money.ts`). In raw SQL, sum money as `::bigint` and read it with `moneyNumber()`, never `::int`. A new
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
- Nights are ISO dates, or `DateRange { checkIn, checkOut }` from `src/utils/dates.ts`. The check-out night is free.
- All or nothing: every database step of one change goes in one `runInTransaction`, and nothing inside catches an
  error to carry on, so a failed step undoes the steps before it. Never call Stripe, Whish, R2 or email inside the
  transaction: write our row first, call after the commit, and undo an upload whose row was not saved. Each such
  service has an integration test that makes a later step fail and finds nothing left (`02` Part 3, "All or
  nothing").
- A feature is built backend first: its API pull request (routes, `docs/openapi.json`, tests, checked by hand in
  Postman or Swagger) is merged before its screens pull request (`docs/team/README.md`).
- Small side writes (logs, usage, "last used") go in `inBackground(label, work)` from `src/server/background.ts`.
  Slow or must-happen work (AI answers, emails, push, scheduled jobs) is a job: `defineJob(queue, kind, handler)`,
  with its file listed in `src/server/jobs/registry.ts`. Job data holds ids and plain values only, never a
  `TenantContext`. An AI route calls `runOrQueue(job, data, estimateSeconds)` and answers with `jobResponse`; the
  screen calls `api.run`. Never await slow work on the request path.
- Functions that depend on the time take `now = new Date()` as the last argument, so tests can set the time.
- Settings come from `env` (`src/server/env.ts`), never `process.env`. A new setting is declared there, explained in
  `.env.example`, and added to `docker-compose.prod.yml` if production needs it.
- A new bell entry needs four things: the log call, the action in `notification-feed-service.ts`, an icon (and link)
  in `notification-list.tsx`, and its text in the three message files. A new email or push is a `notify` job in the
  module that owns the event (`<module>-notifications.ts`), built like `notifyInvitation` in
  `src/modules/team/server/team-notifications.ts`.
- Booking needs an account: public booking routes call `requireUser(request)` first.
- No repeated code. Before you write a helper, search for one in `src/utils`, `src/lib`, `src/hooks`,
  `src/components/ui` and `src/config`. If two places need the same logic, put it in one shared place: `src/utils`
  for pure functions (dates, money, slugs), `src/lib` for library setup both sides use (shared Zod checks,
  `api-client`), `src/hooks` for hooks many screens use. A helper only one module needs stays in that module.
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
- After any schema change: `pnpm exec prisma generate`, `pnpm run docs` (ERDs and API contract), and update
  `docs/team/07-data-model.md` (and `docs/erd-explained.md` if a table's meaning changed).

## Rules for the AI

- An AI tool is `defineTool({ name, description, input: z.object(...), requires, mutates, run })` in
  `src/modules/assistant/server/team-tools.ts` (owners) or `guest-tools.ts` (guests). `run` calls an existing service, through its
  module's `server.ts`, with the context. Tools never take a `businessId` and never query the database.
- Tools that change data have `mutates: true`. In the dashboard chat, the person confirms them. The model never runs
  them directly.
- Wrap text written by guests with `guestWritten(text)`.

## Before you say a task is done

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, `pnpm test`, and the integration tests for the
   feature (`pnpm exec vitest run --project integration src/modules/<name>/tests/<file>.integration.test.ts`). Run them one at a time.
   Never run them next to `pnpm dev` on a small computer.
2. If you added or changed an API route, write it in `docs/openapi.json` to match its Zod schema (once
   `scripts/openapi.ts` exists, add it there instead: it generates the file) and run `pnpm run docs` (it also writes `docs/openapi.yaml`).
3. Every new text is in `messages/en.json`, `ar.json` and `ar-LB.json` (Lebanese Arabic, spoken style). A key you
   stopped using is removed from all three.
4. If you changed how something works (a rule, a flow, a table, a setting), update the matching file in
   `docs/team/` and `docs/` in the same pull request. These files are how the next person, and you in the next
   session, know what to do. A change the documents do not describe is not finished.
5. If `pnpm typecheck` reports an error in a file you did not touch, or about a key that exists, run
   `pnpm exec tsc --noEmit --incremental false` once: the build cache in `tsconfig.tsbuildinfo` can be stale.
6. Report exactly: what you changed, which checks you ran and their results, and anything you could not do. Never say
   a check passed if you did not run it.
```

---

## Part 2. The prompt template

### Why use a template

Each part of the template fills a gap that Claude would otherwise guess. Filling it takes five minutes. It saves an
hour of review. Copy it for every task.

### The template (copy it, and fill every part)

```
## Task
<The feature and its requirement ids from 06-functional-requirements.md, for example "Rooms, prices and
closed dates (F7, F11)">

## Goal
<One or two sentences: what a guest or host can do when this is finished.>

## Read first
- docs/team/02-architecture-and-features.md, section <name>
- docs/team/05-project-structure.md
- docs/team/04-test-plan.md, the tests for <feature>
- <the existing files to copy the style from, for example
  src/modules/bookings/server/booking-service.ts for a service,
  src/app/api/workspaces/[businessId]/bookings/route.ts for a route>

## What to build
<A numbered list. Each item names its file:>
1. Repository: src/modules/<name>/server/<area>-repository.ts — functions <names> (what each returns)
2. Service: src/modules/<name>/server/<area>-service.ts — functions <names>, permission <name>, rules <list>
3. Schemas: src/modules/<name>/schemas.ts — <schemaName> with fields <list and limits>
4. Routes: src/app/api/... — <METHOD path> calling <service function>
5. Screen: src/app/... and src/components/... — <what the page shows and does>
6. Text: keys under <namespace> in every language file
7. Tests: <test files and cases from 04-test-plan.md>

## Rules for this task
<Things special to this task. For example: "use quoteStay for prices", "lock the room",
"staff without rooms.manage get 403", "no database change: the columns exist">

## Not in this task
<What NOT to do, so Claude does not wander. For example: "no week view",
"do not touch booking-service.ts", "no new packages">

## Done when
<Things you can check:>
- <something to click through, and with which demo account>
- <tests that must pass>
- pnpm typecheck, lint, format:check, knip, test all pass

## How to work
First, write a short plan and show it to me before writing code. Then build in the order above, and run the type
check after each piece. At the end, list every file you changed and the result of every check you ran.
```

### What each part does

#### Task

Links the work to the plan. Then the pull request, the standup and the review talk about the same thing.

#### Goal

Written from the user's side ("an owner can add a room with its price"), not the code's side ("add room CRUD"). It
tells Claude what matters when there are two ways to do something.

#### Read first

The most useful part. Claude copies whatever it reads. Point it at the right section of the architecture file, and at
one existing file of the same kind (a service like `booking-service.ts`, a route like the bookings route, a form like
`settings-form.tsx`). Then the new code looks like the rest.

#### What to build

Names every file and function. When files are named, Claude does not invent folders or put a query in a route. List
them in layer order: repository, service, schema, route, screen, text, tests. This is also the order to build them.

#### Rules for this task

The few facts that are special to this feature: which permission, which helper to reuse, which edge case matters.

#### Not in this task

Claude likes to "improve" nearby code. Saying what not to touch keeps the pull request small and easy to review.

#### Done when

Turns "looks finished" into checks. Add at least one thing to click through, and the tests that must pass. Claude
runs them and reports.

#### How to work

Asking for a plan first lets you catch a wrong idea before any code exists. Asking for a list of changed files and
check results makes the report honest and easy to review.

---

## Part 3. Full examples

### Example A: a feature with a screen and an API

```
## Task
Rooms, prices and closed dates (F7, F11)

## Goal
An owner can add, edit and turn off rooms (name, capacity, beds, base price, minimum nights, amenities) from a phone,
and set a special price per night for some dates.

## Read first
- docs/team/02-architecture-and-features.md, Part 3 (layers), Part 4 (requests), "R. Rooms (dashboard)", "P. Pricing"
- docs/team/05-project-structure.md
- docs/team/04-test-plan.md, the tests for Rooms and Special prices
- src/modules/bookings/server/booking-service.ts (service style), src/modules/bookings/server/booking-repository.ts
  (repository style), src/app/api/workspaces/[businessId]/bookings/route.ts (route style),
  src/components/dashboard/settings-form.tsx (form style)

## What to build
1. Repository: src/modules/rooms/server/room-repository.ts — listRooms(db, businessId), findRoom(db, businessId, roomId),
   createRoom(db, data), updateRoom(db, businessId, roomId, data) returning true or false, setRateOverrides(tx, ...)
2. Service: src/modules/rooms/server/room-service.ts — listRooms(ctx) and getRoom(ctx, id) need rooms.read;
   createRoom, updateRoom and setSpecialPrice need rooms.manage; createRoom calls
   assertPlanAllowsAnother(ctx.businessId, "rooms"); every change calls recordAction
3. Schemas: roomInput, roomUpdate (roomInput.partial()), specialPriceInput (at most 366 nights) in schemas.ts
4. Routes: GET/POST /api/workspaces/[businessId]/rooms, GET/PATCH .../rooms/[roomId], GET/PUT .../rooms/[roomId]/prices
5. Screen: src/app/dashboard/[businessId]/rooms/page.tsx (list), loading.tsx, room-editor.tsx, special-prices.tsx
6. Text: dashboard.rooms.* in en.json and ar.json
7. Tests: src/modules/rooms/tests/rooms.integration.test.ts (see 04-test-plan.md)

## Rules for this task
- Create exportToken with secureToken() when the room is created.
- Staff without rooms.manage get 403 from the API and see no edit buttons (check can(ctx, "rooms.manage") in the page).
- Prices are cents in the database. The form shows whole units (dollars).

## Not in this task
No photos, no whole-place unit, no database change, no new packages.

## Done when
- As the owner, on a 390 px screen, I add a room, change its price, and set a special price for 3 nights.
- As front desk staff, the API answers 403 to POST /rooms.
- src/modules/rooms/tests/rooms.integration.test.ts passes; pnpm typecheck, lint, format:check, knip, test pass.

## How to work
Write a plan first and show me. Build in the order above, with the type check after each piece. At the end, list the
changed files and the result of every check.
```

### Example B: a screen task

```
## Task
F2 (part 2 of 3). The booking box on the place page

## Goal
On a phone, a guest picks check-in and check-out (taken nights are greyed out), sets the number of guests, sees the
price per night and the total, and goes to the booking form.

## Read first
- docs/team/02-architecture-and-features.md, "P. Places and rooms (public)", "P. Pricing", "D. Design system",
  Part 8 (how to build screens)
- docs/team/08-design-system-and-pages.md, Part 6 (components) and the `/p/[slug]` entry in Part 8
- src/components/ui/button.tsx, src/components/ui/field.tsx, src/lib/api-client.ts, src/utils/format.ts

## What to build
1. src/components/booking/use-room-calendar.ts — useTakenNights(slug, roomId, month) and useRoomQuote(slug, roomId,
   range), calling GET /api/public/places/[slug]/rooms/[roomId]/availability and /quote with api.get
2. src/components/ui/date-range-picker.tsx — a two-month calendar where taken nights cannot be picked
3. src/components/booking/booking-widget.tsx — dates, GuestCounter, PriceBreakdown, and a ButtonLink to the request page
4. Text under booking.* in every language file

## Rules for this task
- Tokens only. Button and ButtonLink for every button. formatMoney for every price.
- While the price loads, show a Skeleton, not a spinner over everything.
- If the room is no longer free, say it calmly and clear the dates.

## Not in this task
No changes to the API routes or services. No payment buttons.

## Done when
- On a 390 px screen, in English and Arabic, taken nights cannot be picked, and the total matches the price route.
- pnpm typecheck, lint, format:check, knip, test pass.

## How to work
Write a plan first and show me. Then build, and check the screen at 390 px after each component.
```

### Example C: a test task

```
## Task
Prove business isolation (NFR business isolation)

## Goal
Prove that a member of business A cannot read or change anything of business B through the real API routes.

## Read first
- docs/team/04-test-plan.md, "Tenancy, roles and permissions"
- tests/integration/helpers.ts, tests/integration/http.ts, src/modules/bookings/tests/booking-flow.integration.test.ts

## What to build
tests/integration/tenant-isolation.test.ts with one describe block per area (rooms, bookings, calendar, team,
settings, analytics). For each one: A's owner calls B's route with B's real ids and gets 404, and B's data does not
change.

## Rules for this task
Use the helpers to create users, businesses and bookings. Call the routes through tests/integration/http.ts, not the
services, so the whole path is tested.

## Done when
The test passes. And it fails if you remove the businessId filter from one repository function (try it, then put it
back).
```

### Example D: a bug fix

```
## Task
fix: the Confirm button stays after confirming (F9)

## What happens
1. Sign in as the owner, open a waiting request, press Confirm, and accept the dialog.
2. The booking is confirmed, but the Confirm button is still there. Pressing it shows
   "A confirmed booking cannot become confirmed".

## What should happen
After confirming, the page refreshes and only shows the actions for a confirmed booking (Cancel).

## Read first
src/components/dashboard/booking-actions.tsx, src/hooks/use-action.ts

## Done when
After the steps above, only Cancel shows. A test covers it if the cause is on the server. The checks pass. Explain
the cause in one sentence before you fix it.
```

### Example E: ask Claude to review your pull request before a person does

```
Review the changes on this branch compared to development, as a strict reviewer for this project.
Check them against CLAUDE.md and docs/team/02-architecture-and-features.md, Part 13 (the checklist):
layers, permissions in services, schemas on every input, value lists from src/config, no repeated code,
design tokens, text in every language, loading and empty states, and the tests from 04-test-plan.md.
For each problem, give the file and line, why it matters, and the fix. Do not change any code.
```

---

## Part 4. Habits that give the best results

### One task per conversation

Start a new Claude conversation for each task. Long conversations drift and forget the rules from the start.

### Plan, then build, then check

Ask for a plan first and correct it. Then let Claude build in small steps, with the type check between steps. Big
changes in one go are harder to review and more often wrong.

### Point at real files

"Like `booking-service.ts`" works better than any description of a style. Always name the file to copy.

### Make it run the checks

Claude can run the commands itself. Ask it to run the checks and show the results. Do not accept "it should pass".

### Keep pull requests small

If Claude's plan touches more than about ten files, split the task into several pull requests.

### Never paste secrets

Do not paste `.env` content, API keys or customer data into a prompt. Use the demo data and fake values.

### When Claude is wrong or stuck

Stop it. Say exactly what is wrong (for example, "this query belongs in the repository, not the service"). Point at
the rule in `CLAUDE.md`. If the same mistake happens twice, add a clearer rule to `CLAUDE.md` in a pull request.
