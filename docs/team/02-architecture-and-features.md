# Architecture and features

This file explains how the product works and how its code is built. It describes the reference project (`se-next-stays`, the first version of Mabeet),
with the changes we decided for the new project: the three booking modes, full refunds and DigitalOcean hosting
(`06-functional-requirements.md` and `07-data-model.md`). When this file and those two disagree, those two win.

When you or Claude build a feature, build it the way this file says. If something is not here, ask on Discord before
you invent a new way.

Each point has a short title and a full explanation. When there is a rule, the reason is given too. This helps you
use the rule in new cases.

New words are explained in `README.md` (the glossary).

---

## Part 1. The product

### What it is

A website where Lebanese guesthouses take bookings directly.

- Guests find a place, choose dates and book.
- Each business picks one of three modes: automatic (pay online, confirmed at once), online with approval (pay
  online, the owner confirms), or offline (the guest and the owner arrange payment themselves, the owner confirms).
- Online payments are always the full amount, and refunds are always full and automatic.
- Hosts manage their rooms, one calendar, requests, payments and their team.
- The calendar stays in sync with Airbnb and Booking.com.
- Nobody pays a commission. The platform only earns money from host plans.

### The problem it solves

- Airbnb and Booking.com take 15 to 18 percent of every booking.
- Direct requests come on Instagram and WhatsApp. Hosts confirm them by hand.
- Sometimes a direct booking and an Airbnb booking land on the same night (a double booking).

Our product gives the host one booking page, one calendar, and a database that refuses double bookings.

### Who uses it

- **Guests:** browse, book, pay, cancel with a private link, and ask their own AI app about places (read-only).
- **Owners:** can do everything in their business, including money, settings and the team.
- **Staff:** can only do what their role allows. For example, "Front desk" handles bookings and closed dates, but
  cannot see money or settings.
- **Platform admins:** watch the whole platform, help any business, send payouts by hand, and can suspend a business.

### The main flow (what must work on stage)

1. A guest opens a place's booking link and picks dates. Nights already taken on Airbnb or Booking.com are greyed
   out.
2. The guest enters their name and phone and pays the full amount with Whish or a card (mode 2, online with
   approval). The room is held for them right away.
3. A second guest asks for the same night. They are refused at once, because the database will not save two stays
   on one room night.
4. Whish or Stripe confirms the payment. The owner gets the request. The app reads the Airbnb and Booking.com
   calendars again. The owner confirms.
5. The guest's page shows "confirmed". The night is now closed on Airbnb and Booking.com too, through our calendar
   link.

---

## Part 2. The tools we use

### The tools, and why

- **Next.js 16 (App Router) with TypeScript in strict mode:** pages, the API, the calendar links and the MCP server,
  all in one project and one deploy.
- **PostgreSQL with Prisma 6:** the database, with typed queries and migrations. Postgres also gives us database
  rules that Prisma cannot write, such as the rule against overlapping nights. We write those rules by hand in SQL
  migration files.
- **Better Auth:** sign in with email and password, and sessions saved in the database. It also lets AI apps connect
  with OAuth (a safe sign-in for apps).
- **Zod 4:** checks every input: API input, AI tool input, settings in `.env`, and answers from DeepSeek, Stripe and
  Whish.
- **next-intl:** English, Arabic and Lebanese Arabic. Arabic is right-to-left.
- **Tailwind CSS 4:** styling, using design tokens only.
- **MCP:** how AI apps (Claude, ChatGPT, Cursor, Codex) use our tools. The model runs in the person's own app.
- **DeepSeek:** our own AI model, for the last bonuses only (the dashboard assistant, the website travel
  assistant, the AI report). Changing to another AI provider means changing one file.
- **Vitest:** unit tests (no database) and integration tests (real database).
- **DigitalOcean with Docker:** hosting for the website and the PostgreSQL database. One Docker image runs twice: as
  the website (`pnpm start`) and as the job worker (`pnpm worker`). Real emails are sent with Resend from our own
  domain.
- **pg-boss:** job queues kept in our own PostgreSQL (in a `pgboss` schema), so slow AI work, emails and scheduled
  jobs run in the worker, not in the web request. The queues need no Redis.
- **Redis:** only for rate-limit counters, shared by every web instance. It runs as a `redis` container beside the
  website in `docker-compose.prod.yml` and `docker-compose.yml` (`REDIS_URL`). It holds nothing that must survive a restart.
- **GitHub Actions:** runs the checks on every pull request, and deploys every merge to `main` that passes.

### Settings (environment variables)

- Every setting is declared once in `src/server/env.ts` (Zod). Code reads `env.X`, never `process.env.X`.
- An optional setting uses the `optional(...)` helper, so an empty value in a copied `.env.example` counts as unset.
  Give it a sensible default or a clear fallback (Redis: count in memory; Resend: print emails to the log).
- Add it to `.env.example` with a comment saying what it is for and what happens without it.
- If production needs it, add it to `docker-compose.prod.yml` (a service address such as `REDIS_URL` points at the
  service by name). Only a setting the build itself checks needs a placeholder in the `Dockerfile` build step.
- Tests set their own values in `tests/integration/setup-env.ts` (their own database, no real email, jobs inline).

### The checks CI runs

- `pnpm typecheck`: no TypeScript errors.
- `pnpm lint`: ESLint, including the layer rules, type imports, no unused variables, and `===` instead of `==`.
- `pnpm format:check`: Prettier formatting (it also orders Tailwind classes).
- `pnpm knip`: no unused files, exports or packages.
- `pnpm test`: unit tests.
- `pnpm test:integration`: integration tests with a real database.
- The generated documents (`docs/erd.md`, `docs/openapi.json`) must match the code. CI fails if they are out of date.

---

## Part 3. The layers (the most important part)

### Modules, then four layers inside each

The app is a modular monolith. Each feature is a module in `src/modules/<name>/` (the map is in
`05-project-structure.md`). A module holds its own services, repositories, input checks, screens and tests,
and is entered only through `index.ts` (input checks, types, screens) and `server.ts` (its services). One module
calls another only through that module's `server.ts`, never in a circle, and passes `tx` when both changes must
commit together. What must be one transaction stays in one module: no double booking needs availability, the
hold and the lock together, so they all live in `bookings`. The shared kernel, `src/server/`, holds what every
module uses and never imports a module.

Inside each module, the layers go one way:

```
routes and pages  →  services  →  repositories  →  database
(read the input,      (all rules,      (the only code that
 check it, answer)     permissions,     talks to the database)
                       transactions)
```

The website, the AI chat and the MCP server all call **the same services**. So a rule or a permission is written
**once** and works everywhere. This is the most important design choice. Never put a rule anywhere else.

### Routes and pages (`src/app/**`)

They do four things only:

1. Read the request.
2. Check the input with a Zod schema from the module's `index.ts`.
3. Call **one** service function, from the module's `server.ts`.
4. Send the answer.

They have no business rules and never talk to the database. ESLint stops any import of a module's inner files (its
repositories included) or of `@/server/db/*` from `src/app`.

### Services (`src/modules/<name>/server/<area>-service.ts`)

They hold every rule:

- permission checks, for example `requirePermission(ctx, "bookings.decide")`,
- business rules, for example "the dates must be in the future" or "the room must fit the guests",
- transactions with `runInTransaction` (several database changes that succeed or fail together),
- notifications,
- the audit log with `recordAction` (a record of who did what).

Services are plain functions, grouped by area. When a service works inside a business, its first argument is a
`TenantContext`.

### Repositories (`src/modules/<name>/server/<area>-repository.ts`)

The only code that runs database queries.

- The first argument is the database handle: `db: Db` for normal queries, or `tx: Tx` when the query must run
  inside a transaction.
- This way, a service can run several repository functions in one transaction.
- Every query on a business's data filters by `businessId`.
- Repositories make no decisions and check no permissions.

### The database (`prisma/schema.prisma`, `prisma/migrations/**`)

The last guard.

- The `occupancy_no_overlap` rule refuses overlapping nights.
- Triggers (automatic database checks) refuse selling more seats than a session has.
- CHECK rules keep values sensible (for example, check-out after check-in).

The database never trusts that the code is right.

### How a service uses the database

Services import `prisma` and `runInTransaction` from `src/server/db/client.ts` and pass them to repositories:

```ts
const booking = await bookings.findBooking(prisma, ctx.businessId, bookingId);
await runInTransaction(async (tx) => {
  await lockActiveRoom(tx, ctx.businessId, roomId);
  await bookings.changeStatus(tx, ctx.businessId, bookingId, { status: "CONFIRMED" });
});
```

Only services import `prisma`. ESLint stops `@prisma/client` from being used outside repositories, except for types
(`import type`).

### All or nothing: when one step fails

A change that touches several rows, tables or features either happens completely or not at all. If step 2 fails,
step 1 is undone at once; we fix the cause and run the whole change again from step 1.

1. **Every database step of one change goes in one `runInTransaction`.** If anything inside throws (a check, a
   database refusal, a bug), Postgres undoes every write before it, and the error reaches the person as a clear
   message. Never save step 1 in one transaction and step 2 in another. Never catch an error inside the transaction
   to carry on: let it throw. The only catching is `overlapAsConflict` and `duplicateAsConflict`, which turn the
   refusal into a clear error and still throw.
2. **Checks first, writes after.** A service checks the permission, then everything it can check (the input, the
   status, the plan's limits), and only then writes. Most failures stop before anything is written.
3. **Emails and push are jobs sent after the commit** (`defineJob` on the `notify` queue). A change that is rolled
   back never sends anything. A job that fails is retried, and every job handler can run twice safely.
4. **Outside services cannot be undone by Postgres** (Stripe, Whish, R2), so:
   - **Money:** our row is written first, inside the transaction (a payment waiting, a refund to send), and the call
     to Stripe or Whish comes after the commit. If the call fails, the row stays, the scheduled job checks it again,
     and a refund that keeps failing shows on the admin's money page to send by hand. Webhooks and callbacks can come
     twice: each one is applied once (the payment's provider reference is unique).
   - **Uploads:** the photo is uploaded to R2, then its row is saved. If the save fails, the service deletes the
     uploaded file again before throwing, so no file is left without its row.
   - Never call an outside service inside `runInTransaction`: it would hold the room's lock while waiting, and the
     call could not be undone anyway.
5. **Calls that must follow a commit** (`recheckImportClashes`, `inBackground` writes) run only after
   `runInTransaction` returns, so they never see a change that was rolled back.
6. **Migrations** (only the database keeper): one migration does one change. Before it is merged, it runs on a fresh
   database (`pnpm db:deploy` and the integration tests in CI) and on a copy of the live data. The live database is
   backed up before every deploy that runs a migration. If a migration fails on a database: restore it if anything
   was half applied, mark it with `pnpm exec prisma migrate resolve --rolled-back <migration>`, fix the cause in a new
   pull request, and deploy again. A merged migration is never edited; a new migration undoes it.
7. **Code:** every pull request is one squashed commit, so a merged change is undone with one `git revert`
   (`docs/team/README.md`, "Undoing a merged change").

Every service that writes in several steps has an integration test that makes a later step fail and checks that
nothing of the earlier steps stayed in the database (`04` Part 2).

---

## Part 4. Requests, errors and input checks

### Every API route uses one wrapper

`src/server/http/route.ts` has two wrappers:

- `route(handler)` for public routes,
- `tenantRoute(paramsSchema, handler)` for business routes (`/api/workspaces/{businessId}/...`).

The wrapper:

- refuses writes that come from other websites,
- turns our errors into the right HTTP code,
- never shows internal errors. An unexpected error is logged, and the user sees "Something went wrong" (code 500).

```ts
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  await enforceRateLimit(`assistant:${ctx.userId}:${ctx.businessId}`, 15, 60_000);
  const input = await parseBody(request, chatInput);
  return json(await answerChat(scope, input, (history) => askTeamAssistant(ctx, history)));
});
```

### `tenantRoute` makes the business check impossible to forget

It does these steps before your code runs:

1. Reads the URL parts with the schema.
2. Checks the user is signed in (401 if not).
3. Checks the user is a member of the business in the URL, using `resolveContext`. If not, it answers 404 (not 403),
   so nobody can learn that a business exists.
4. Calls your handler with `{ request, ctx, params }`.

### Errors are objects with a code

`src/server/errors.ts` has `AppError(code, message, details?)` and helpers:

| Helper                 | HTTP code | Use it when                                |
| ---------------------- | --------- | ------------------------------------------ |
| `notFound("Room")`     | 404       | the thing does not exist (or is not yours) |
| `forbidden(message)`   | 403       | the user lacks a permission                |
| `conflict(message)`    | 409       | the action clashes with the current state  |
| `unauthenticated()`    | 401       | the user is not signed in                  |
| `invalid(message)`     | 400       | the input is wrong                         |
| `unavailable(message)` | 503       | a service (AI, payments) is not available  |

Services throw these. The wrapper turns them into answers. Write messages that people understand, for example
"Those dates were just taken. Please pick other dates." `localizeError` translates them.

### Database refusals become clear errors in one place

`src/server/db/constraint-errors.ts` wraps a database write:

- `overlapAsConflict(message, write)`: when the database refuses overlapping nights (Postgres code `23P01`), the
  user gets a 409 with your message.
- `duplicateAsConflict(message, write)`: the same, when a unique rule refuses a second copy (`P2002`).

Never write your own try/catch for these.

### Every input is checked with Zod

- Each module's API input schemas are in its `schemas.ts`, exported through its `index.ts`.
- Use `parseBody`, `parseQuery` and `parseParams`. Never read `request.json()` yourself.
- Wrong input gets a 400 answer with the wrong fields. The screen then highlights those fields.
- Reuse the small shared pieces in `src/lib/schemas.ts`: `id`, `isoDate`, `phone`, `cents`, `stayDates`,
  `workspaceParams`.

### Lists of values live once, in `src/config/`

Statuses, payment methods, plans, report topics and listing kinds are lists in `src/config/enums.ts`, `plans.ts`
and `listing.ts`. Each list is checked against the database list with `satisfies`.

- Schemas use them: `z.enum(BOOKING_STATUSES)`.
- Screens loop over the same list.
- Types come from the list: `type PaidPlan = (typeof PAID_PLANS)[number]`.

Never type `"PRO" | "BUSINESS"` or `["HELD", "CONFIRMED"]` by hand.

### Limits on public and costly actions

`enforceRateLimit(key, limit, windowMs)` limits how often someone can do something (for example, 8 AI messages per
minute). It counts in Redis, so it works across all servers: one atomic script per hit (`INCR`, then `PEXPIRE` on
the first hit), and each window's key expires by itself, so nothing needs cleaning up. There is no rate-limit table.
Without `REDIS_URL` (local development, tests) it counts in the process's memory. Code: `src/server/http/rate-limit.ts`.

- Public forms use the visitor's address: `clientAddress(request)`.
- Signed-in actions use the user and the business.

---

## Part 5. Sign in, businesses and permissions

### Three questions, in this order

1. **Who are you?**
   - On the website: a Better Auth session cookie.
   - For AI apps: a personal API key (`mbt_…`, we only store a hash of it) or an OAuth token.
   - For scheduled jobs: the `CRON_SECRET` key.
2. **Which business?** Always from the URL (`/api/workspaces/{businessId}/…`) or from the key or token. Then we check
   the user is a member. **Never** from the request body.
3. **Are you allowed?** The service checks a permission on the `TenantContext`.

### `TenantContext`: who, where, and with what rights

It is defined in `src/server/auth/tenant-context.ts`. It is built once per request and passed to every service:

- `resolveContext` builds it on the website,
- `resolveKeyContext` builds it for an API key,
- `resolveTokenContext` builds it for an OAuth token.

```ts
interface TenantContext {
  userId: string;
  businessId: string;
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
  channel: "web" | "mcp" | "chat";
  platformAdmin?: boolean;
  readOnly?: boolean;
}
```

Helpers:

- `can(ctx, permission)`: true or false.
- `requirePermission(ctx, permission)`: throws 403 if the permission is missing.
- `requireOwner(ctx, refusal)`: for things only an owner can do (money, plans, payouts).

### Permissions and roles

`src/config/permissions.ts` lists the permissions: `rooms.read`, `rooms.manage`, `offerings.manage`,
`calendar.read`, `blocks.manage`, `feeds.manage`, `bookings.read`, `bookings.decide`, `guests.contact`,
`reviews.reply`, `analytics.read`, `team.manage`, `roles.manage`, `settings.manage`, `ai.use`. There is no
permission for recording payments: nothing is paid or recorded by hand. Money, plans and payouts are for the owner
only (`requireOwner`).

- Each business has an owner role (all permissions, cannot be changed).
- Each business also gets default roles (Manager, Front desk, Housekeeping), which it can change.
- Owners can make new roles by ticking permissions.
- Nobody can give a permission they do not have.
- A read-only AI key only keeps the reading permissions: `rooms.read`, `calendar.read`, `bookings.read`,
  `guests.contact`, `analytics.read` and `ai.use` (`readOnly` in `src/config/permissions.ts`).

### Staff without `guests.contact` see hidden contact details

`presentForStaff(ctx, booking)` hides the guest's phone and email (for example `+961 70 ••• •45`) for staff without
this permission. Every staff list or page of bookings uses it.

### Platform admins

A user with `platformRole = SUPER_ADMIN` can open any business's dashboard with all permissions. This only works on
the website, never through AI keys. Their actions are logged under their own name.

Nobody becomes an admin by signing up: `platformRole` is not something a sign-up can set. Admins are made only with
`pnpm admins:create "Name <email>" …` (`scripts/create-admins.ts`, which calls `ensurePlatformAdmin` in
`src/modules/accounts/server/platform-admin.ts`). It creates a verified account, or makes an existing one an admin, gives each a
new random password, and writes the sign-in details to `.admin-credentials`, which git ignores. Running it again
never makes a copy.

---

## Part 6. The database

### Every taken night is one row in `Occupancy`

Direct bookings, closed dates and Airbnb stays are all rows in `Occupancy`. Each row has:

- a `kind`: `DIRECT` (our booking), `MANUAL` (closed by the host) or `IMPORTED` (from Airbnb or Booking.com),
- a room,
- `checkIn` and `checkOut` (dates; the check-out night is free),
- an `active` flag,
- optional links: `bookingId`, or `feedId` with `externalUid` for imported stays.

Availability, the calendar, our calendar link and the overlap rule all read `Occupancy`, never `Booking`. A new
source of taken nights is a new `kind`, not new checks.

### `Booking` holds the guest's request and the money

A booking has:

- a `reference` like `MB-7KX3P9` (shown to people),
- a secret `publicToken` (the guest's private link),
- the guest's name, phone, email and note, and `guestCount`,
- `checkIn` and `checkOut`,
- `totalCents` and `currency` (an online payment is always the full `totalCents`; there are no deposits),
- `bookingMode` (copied from the business when the booking is made),
- `status` and `holdExpiresAt`,
- who decided, and when.

Its one `Occupancy` row takes the nights.

### `Business` holds the host's settings

- name, `slug` (the public web address), area, phone numbers,
- `timezone` (`Asia/Beirut`), `currency`,
- `commissionRateBps`: the commission a direct booking saves (1500 means 15 percent),
- `holdHours` (how long the owner has to answer),
- `bookingMode`: `AUTOMATIC`, `ONLINE_APPROVAL` or `OFFLINE`,
- `onlineTermsAcceptedAt` (when the owner accepted "online payments are always refunded in full"),
- `bookingUnit` (`ROOMS` or `WHOLE_PLACE`), `listedPublicly`, `status`, `plan`.

### `Room`, `RateOverride`, `CalendarFeed`

- A **room** has a name, capacity, beds, `baseRateCents`, `minNights`, amenities, a secret `exportToken` (its
  calendar link), a `kind` (`ROOM`, or the one `WHOLE_PLACE` unit), and `active`.
- A **rate override** is a special price for one room on one date.
- A **calendar feed** is an Airbnb or Booking.com link for one room, with `lastSyncedAt` and `lastError`.

### `Role` and `Membership`

- A role belongs to one business and lists permission names.
- A membership links one user to one business, with one role and a status (`ACTIVE` or `REMOVED`).
- A user has at most one membership per business.

### Money tables: `Payment`, `Refund`, `Payout`, `PlanPayment`

- A payment belongs to a booking. It has an amount, currency, method, status, an `online` flag, and two provider
  references that mean different things: `providerRef` is the checkout (a Stripe Checkout session id, or
  `whish:<payment id>`), used to look it up and settle it, and unique so it is never settled twice;
  `providerPaymentId` is the charge it produced (Stripe's payment intent), only needed to refund a card payment.
- Refunds and payouts are separate rows.
- A `PlanPayment` is a host paying for a plan, always instantly (Stripe or Whish). It records who paid (`paidById`)
  and the months it bought. A CHECK constraint refuses any new plan payment that is not `STRIPE` or `WHISH`.
- We never store a "balance". We calculate it: online payments − refunds − payouts.

### Log and AI tables

- `AuditLog`: what happened in a business or on the platform, and who did it (`actorId`, empty for the system's
  own events such as a payment callback or a calendar clash). The business and admin bells and the admin audit
  trail read it.
- `ActivityLog`: one person's own timeline (their requests, favourites and reviews, and what happened to them),
  shown on their account's Activity page.
- `McpAuditLog`: every AI tool call (tool, result, time taken, channel).
- `AiUsage`: tokens and cost of each AI answer, for the monthly budget.
- `AiChat` and `AiChatMessage`: saved AI chats, per person.
- `JobProgress`: what a queued AI answer has written so far, shown live; deleted when the job ends.

### Job queues (not in Prisma)

pg-boss keeps the queues in its own `pgboss` schema in the same database: jobs, queues and schedules. It creates and
upgrades that schema itself when the worker starts. We never write to it with Prisma; we use `defineJob`,
`runOrQueue` and `findJob` in `src/server/jobs/queue.ts`. Finished AI jobs are deleted after an hour, others after
a day.

### Nothing is deleted (soft delete)

Business data is never removed. Each business table has `isDeleted Boolean @default(false)`:

- **Deleting** is an update: `updateMany({ where: { id, businessId, isDeleted: false }, data: { isDeleted: true } })`.
  It returns whether a row changed, so the service can answer 404 for something already gone.
- **Every read skips deleted rows**: `isDeleted: false` in the repository's `where` (and in nested `include`s).
  Never rely on the caller to filter.
- **Creating something deleted again brings the old row back** when a unique key would otherwise refuse it (a
  category slug, a role name, a favourite): first `updateMany({ where: { <key>, isDeleted: true }, data: { ...data,
isDeleted: false } })`, and only if nothing changed, `create`. See `createCategory` in `admin-repository.ts`.
- **Only short-lived technical rows are really deleted:** sign-in sessions and tokens, job progress and push devices.
  Rate-limit counters are not rows at all (Redis).
- **Deleting an account** (`softDeleteUser` in `account-repository.ts`, in one transaction): the user is marked
  deleted, their email moves to `deletedEmail` and becomes `deleted-<id>@deleted.invalid` (so the address is free to
  sign up again and nobody can sign in as them), their memberships, API keys, favourites, chats and host profile are
  marked deleted, and their sessions, push devices and AI-app tokens are deleted. Bookings and reviews stay with the
  host, because the host needs them for their records; emails then go only to the address typed on the booking.

### Locks: who waits for whom

Changes that must not race take a row lock (`SELECT … FOR UPDATE`) at the start of their transaction. The lock
functions live in the repositories of the module that owns them; `lockBusinessMoney` is in `payments` and reached
through its `server.ts`, because billing (plan months) and payouts both need it:

| Lock                                       | Taken by                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `lockActiveRoom(tx, businessId, roomId)`   | anything that changes a room's nights: deciding, cancelling, calendar sync, clash recheck |
| `lockBookableRoom(tx, businessId, roomId)` | a new booking, on a room guests can book right now                                        |
| `lockBusinessForBooking(tx, businessId)`   | a new booking at a place with a whole-place unit (rooms and the whole place take turns)   |
| `lockBusinessMoney(tx, businessId)`        | payout requests and plan months, so two requests cannot spend the same balance            |
| the `Payment` row                          | a refund, so two refunds cannot give back more than was paid                              |

Work that follows a committed change (emails, the clash recheck) runs **after** the commit, in its own transaction
with its own lock, and never throws at the change that caused it.

### Rules for the schema

- Ids use `cuid()`.
- Money is always whole minor units (`…Cents`: 9999 means 99.99), never decimals, stored as `BigInt` because LBP
  totals outgrow a 32-bit int. The database client (`src/server/db/client.ts`) reads every money column back as a
  plain `number`, so code does normal number maths. A new money column must be `BigInt` **and** be added to the
  client's `moneyAsNumbers` extension. Where code uses a generated Prisma type with money (`Booking`, `Payment`…),
  wrap it: `MoneyAsNumbers<Booking>` (`src/utils/money.ts`). A raw SQL sum of money is cast `::bigint` and read with
  `moneyNumber()`, never `::int`.
- One fact, one place. Do not add a second field that can say something different from an existing one: for
  example, no free-text cancellation policy beside the refund rule, and no second WhatsApp number beside the
  business's.
- Night dates use `@db.Date`.
- Every business table has a `businessId` and an index on it.
- Index what jobs and searches look up: `(status, holdExpiresAt)` for the hold-expiry jobs, GIN indexes on array
  columns that search filters use (`tags`, `accessibility`, `amenities`). `docs/erd.md` lists every index.
- Deleting a business deletes its data too.
- Enum values are in capital letters.

---

## Part 7. Features from A to Z

Each feature says what it does, where its code is, and the rules that matter.

### A. Guest account

Booking needs an account. A signed-out visitor who presses Book is sent to sign in (or sign up) and comes back to
the same dates; the booking API answers 401 to anyone not signed in (`requireUser(request)` in the route). Every
`Booking` and `SessionBooking` has a required `guestUserId`, and a booking's page (`/b/[token]`) opens only for the
guest who made it.

Guests see their stays (`/account`), save favourites, review a stay after check-out, download all their data
(`GET /api/me/export`), and delete their account (`POST /api/me/delete`, typing their email to confirm; see "Nothing
is deleted"). Code: `account-service.ts`, `src/app/(site)/account/**`.

### A. Activity log and notification bell

Every important action is recorded, through the `audit` module (`@/modules/audit/server`):

- `recordAction(ctx, action, entity, entityId, tx)` for a team member's action, into `AuditLog`. Pass the change's
  transaction, so the change and its log line are saved together or not at all.
- `recordPersonAndBusiness(tx, { userId, businessId, action, entity, entityId })` for something a person did that
  the business must hear about (a guest's request, someone joining the team): it goes on the person's own timeline
  (`ActivityLog`) and in the business's `AuditLog`.
- Something the system noticed (a sync, a payment callback) goes in `AuditLog` with no actor; the audit module
  exports a function for it with the first such event.

The bell in the top bar shows the last five events of the business. "View all" opens the full list. Code:
`audit.ts`, `notification-feed-service.ts`, `notification-bell.tsx`.

The bell is read from `AuditLog`, so it shows only the actions listed in `notification-feed-service.ts`. To add a
new kind of bell entry (all four steps, or it shows a raw key or nothing):

1. Log it, as above. An event with no actor is unread for everyone.
2. Add the action to `BOOKING_NEWS` (people with `bookings.read`), `OWNER_NEWS` (owners) or `PLATFORM_NEWS`
   (admins) in `notification-feed-service.ts`.
3. In `src/components/shell/notification-list.tsx`, give it an icon in `ICONS`, and a link in `hrefFor` if it
   should not go to the bookings page.
4. Add its text as `notifications.actions.<area>_<thing_happened>` (the first dot becomes `_`) in `en.json`,
   `ar.json` and `ar-LB.json`. It may use `{actor}`, `{guest}` and `{reference}` (filled when `entityId` is a
   booking).

### A. Admin area

`/admin`, for platform admins: businesses (suspend or reactivate), hosts, AI spending against the budget, calendar
sync health, payouts and refunds to send by hand, categories, and the
site's colour palette. Code: `admin-service.ts`, `src/app/admin/**`.

### A. AI: how it is built

The AI is another way into the same app, not a separate system.

The order we build it in: first the MCP (the first AI bonus), where the person's own AI app brings the model and calls our
tools. The guest MCP is always read-only and never books. The host MCP's first version only reads and reports; a few
host actions come after it. Our own model (`deepseek.ts`, `assistant.ts`, `output.ts`) is the last bonus, so `tool.ts`, `run-tool.ts`, `team-tools.ts`, `guest-tools.ts` and `mcp-server.ts` must never need it.

- Every AI **tool** is a Zod input check plus a call to an existing service, with the caller's `TenantContext`.
- So the AI has exactly the same rights as the person behind it, and it can never see another business.
- Tools never take a `businessId`. The business always comes from the key, token or session.

The files:

- `src/modules/assistant/server/tool.ts`: the `AiTool` type (`name`, `description`, `input`, `requires` permission, `mutates`,
  `run(input, context)`).
- `run-tool.ts`: `createToolRunner(tools, context, onCall)` checks the input, runs the tool, turns errors into safe
  messages, measures the time, and reports the call to the audit log. `toolPayload` is what the model sees: every
  `somethingCents` next to a `currency` becomes `something: "$140"`, already formatted, so the model never converts
  cents itself (it got it wrong when it had to).
- `deepseek.ts`: `complete(messages, tools)` and `completeJson(messages, maxTokens)`, using one request function.
  Each tool's JSON description is built once and kept (cached).
- `assistant.ts`: `runAssistant` is the tool loop. The model can call tools up to 4 rounds, then it must answer.
  Tools in the same round run at the same time. With `proposeChanges`, tools that change data are **not** run. Their
  checked input comes back as a **proposal** for the person to confirm.
- `output.ts`: the format of every AI answer (see "A. AI: the format of every answer").
- `mcp-server.ts`: `handleMcpRequest` answers one MCP request. It only offers the tools the caller may use. It marks
  tools as "read only" or "changes data".

### A. AI: the owner's assistant (in the dashboard, last bonus)

Page: `/dashboard/{id}/assistant`.

- It answers questions: free rooms, bookings, money, commission saved.
- It can carry out orders, such as "cancel booking MB-7KX3P9" or "close the Arched room from 12 to 15 November".
- It **never** acts on its own:
  1. The model asks for a tool that changes data.
  2. The input is checked against the tool's schema.
  3. The screen shows an `ActionCard` with the exact action and details (from the checked input, not from the
     model's words), and two buttons: **Confirm** and **Don't do it**.
  4. Confirm calls `POST /api/workspaces/{id}/assistant/actions`. This runs `runConfirmedAction`, which uses the same
     tool, checks and permissions as the dashboard buttons. The action is logged.
- Chats are saved for each person. A person can also start an unsaved chat, which is never stored.

Code: `assistant-service.ts`, `chat-service.ts`, `team-tools.ts`, `components/assistant/**`.

### A. AI: connecting Claude, Cursor or Codex (MCP)

Route: `POST /api/mcp`.

- The person connects with a personal API key (made on the "Connect AI" page, with an end date), or by signing in
  with OAuth and choosing a business.
- **First version: read and report only.** Free rooms, bookings, revenue, the commission saved, and the numbers
  for a report over a period (`getBusinessReport`, the same figures as the analytics page). The person's AI app
  writes the report. Every key is read-only.
- **Then: a few actions**, only what the person's role allows: `cancel_booking` (full automatic refund),
  `close_dates` and `reopen_dates`, `confirm_booking` and `decline_booking`. Each calls the same service as the
  dashboard button. Keys can then have write access; read-only keys never see these tools. They are marked as
  changing data, so the AI app asks the person before running them. Marking a guest as arrived needs a new booking
  state from the database keeper first.
- Every tool can take an optional `place`, to work in another of the person's businesses (`resolvePlaceContext`). It
  only allows places the person belongs to. If a name fits several places, it refuses.
- Every call is logged in `McpAuditLog`. The key's "last used" time is updated after the answer (`touchKey`).

### A. AI: the guest's assistant and guest MCP

- For AI apps: `POST /api/mcp/guest` (public), built first.
- On the website: `/assistant`, `POST /api/assistant`, answered by our own model (last bonus).

Both use the read-only `GUEST_TOOLS`: search places, check availability, get a place, search experiences, get an
experience. They only see public data. They give a link to the booking page. They never book: booking through
an AI is cut.

The place cards under a reply are built from the tool results, not from the model's words. So the model cannot
invent a place.

The page `/use-with-ai` (built with the guest MCP) tells guests what MCP is, why and how to connect Claude or ChatGPT, and shows the guest
MCP address in a `CopyField`. It has no chat. `SiteFooter` and the home page link to it.

### A. AI: the format of every answer

Rule: **we always tell the model the exact format we expect, and we always check what comes back before anyone sees
it.** Code: `src/modules/assistant/server/output.ts`.

- **Chat replies** (owner assistant and guest travel assistant):
  - `REPLY_FORMAT` is added to every system prompt by `runAssistant`: short sentences, `**bold**` for key figures,
    `- ` lists, a markdown table for three or more rows of the same kind, and no headings, HTML, code or links.
  - `shapeReply(text)` brings every reply into that format before it leaves the server: it drops code fences and
    HTML, turns headings into bold lines, keeps only the text of links, turns `*` lists into `- `, and cuts an
    over-long reply at a line break. An empty reply becomes `""`, and the screen shows the translated "I couldn't
    find an answer" message.
  - `RichText` (`src/components/assistant/rich-text.tsx`) renders exactly that format: paragraphs, bold, lists and
    real tables (`overflow-x-auto` on phones). It never renders HTML.
- **JSON answers** (the AI report, and any new structured answer):
  - Write the answer's shape as a Zod schema. Call `askForJson({ system, input, schema, maxTokens, onUsage })`.
  - It sends the schema itself to the model (as JSON Schema, from `z.toJSONSchema`), so the prompt and the check can
    never disagree. Never describe the JSON shape by hand in the prompt.
  - If the answer is not JSON or does not match, it is sent back once with the exact problems. A second miss is
    refused with a calm "please try again". Nothing broken is ever shown.
  - `onUsage` is called with the tokens of every attempt, also refused ones, so the AI budget is always right.
- **Tool inputs** from the model are checked by each tool's Zod schema. Changes become proposals that a person
  confirms (`ActionCard`).

### A. AI: checks, limits and fallbacks

- **Input:** every tool input is checked by Zod before it runs. Wrong input returns a clear error to the model.
- **Permissions:** tools use the services' own permission checks. The list of tools is filtered by permission
  (`teamToolsFor(ctx)`).
- **Text from guests:** wrapped as `{ guestWritten: text }`. The instructions tell the model to treat it as data,
  never as orders. This protects against "prompt injection" (a guest writing orders to the AI).
- **Cost:** a monthly budget (`AI_MONTHLY_BUDGET_USD`, $50 by default).
  - `assertWithinBudget` checks it before each question.
  - `recordAiUsage` saves the cost after the answer, in the background.
  - The route checks the budget and the plan **before** queueing, so a refusal is immediate; the job checks again.
  - Admins get one alert at 80 percent and one at 100 percent.
- **Speed:** limits per route, a 45-second time limit for the model, tools in the same round run together, and logs
  are written after the answer. A long question, a long chat, a report, or any question while others wait goes to
  the `ai` queue and the worker answers it (see "B. Queues and the worker").
- **Fallback:** if the model is slow or fails, the person sees a clear message, and the rest of the app still works.

### A. AI report

On the analytics page, "Generate a report" sends the database's numbers for a period to the model with
`askForJson`. The schema (`reportShape(topics)`) is strict: every field is required, and each section's topic must
be one of the topics the person chose. The charts next to each section use the same numbers.
Only for Pro and Business plans. A report always goes to the `ai` queue (it writes up to 2,000 tokens, 20 seconds
or more); the page waits on the job. Code: `report-service.ts`, `jobs/ai-jobs.ts`, `report-generator.tsx`.

### A. Analytics and money saved on commission

Shows, for one place or all the owner's places:

- occupancy, nights sold, direct revenue, average price per night,
- **money saved on commission** = direct revenue × the business's commission rate,
- channels (direct, Airbnb, Booking.com…), requests by result, typical response time, rating.

Revenue is added up per currency, never mixed. All numbers come from the database through safe `$queryRaw` queries
in `analytics-repository.ts`. Code: `analytics-service.ts`, `dashboard/[businessId]/analytics/page.tsx`,
`analytics-charts.tsx`.

### B. Background work

Two kinds, by how much they matter:

- **Small writes** (AI tool logs, AI costs, "last used" times): `inBackground(label, work)` in
  `src/server/background.ts` runs them **after** the answer is sent. If one fails, it is logged. It never breaks
  the request.
- **Work that must happen, or that is slow** (AI answers and reports, emails and push, scheduled jobs): a **job** on
  a queue, run by the worker. See the next section.

### B. Queues and the worker

```
 website ──send job──▶ PostgreSQL (pgboss schema) ◀──takes jobs── worker (pnpm worker)
```

- **The queues** (`QUEUES` in `src/server/jobs/queue.ts`):
  - `notify`: every email and push: team invitations today, then every booking, payment, refund and Contact host
    notice. 8 at once. Retried 4 times, waiting longer each time.
  - `cron`: housekeeping every 5 minutes (`SCHEDULES` in `jobs/cron-jobs.ts`), on the worker's own schedule; the
    calendar sync joins it (every 15 minutes) with F11.
  - `ai` is added with the AI assistants (last bonus): travel and team assistant answers, reports. 4 at once per
    worker, retried once. `runOrQueue`, `GET /api/jobs/{jobId}` and the progress rows come with it; nothing uses
    them before then.
- **Declaring a job:** `defineJob(queue, kind, handler)`. Add the file to `src/server/jobs/registry.ts` so the worker
  knows it. Job data holds only ids and plain values (never a `TenantContext`): the worker loads the rest fresh.
- **Answer now, or queue** (`runOrQueue`): the route estimates how long the work will take from the size of the
  input (`chatSeconds`, `reportSeconds` in `jobs/ai-jobs.ts`). It answers inside the request (200) only when the
  estimate is at most `JOBS_SYNC_LIMIT_SECONDS` (5 by default, so every AI answer is queued today; `0` queues
  everything), nothing is waiting on that queue, and this web process is running fewer than 4
  such answers. Otherwise it queues the job and answers 202 with `{ status: "queued", jobId }`.
- **The browser** uses `api.run(url, body, onProgress)` (`src/lib/api-client.ts`). It handles both answers and,
  for 202, asks `GET /api/jobs/{jobId}` every 0.5–1 seconds until the job is `done` or `failed`.
- **Live answers:** the worker streams DeepSeek's reply. While the job runs, `GET /api/jobs/{jobId}` returns its
  progress (the tool in use, then the reply so far), saved in the `JobProgress` table at most every 300 ms
  (`jobs/progress.ts`). The chat shows "Searching what's free…", then the words as they come: about 2–3 seconds to
  the first ones.
- **Safety:** the route checks rate limit, permission, plan and budget before queueing. The worker looks the member
  up again before running. Only the person who asked can read a job; anyone else gets 404. Stored errors are never
  shown: the client sees the safe message of an `AppError`, or a generic "busy, try again".
- **Modes:** `JOBS_MODE=queue` in production (the Docker image sets it) and with `pnpm dev`, which starts the
  website and the worker together (`scripts/dev.ts`). `inline` runs everything in the web process with no worker:
  the tests always use it, and so do `pnpm dev:web` (the website alone, for a computer short of memory) and
  `docker compose up` (development), so saving a file only needs the website to reload.
  `tests/integration/queue.test.ts` checks the real pg-boss once, in queue mode.
- **Deploys:** on `SIGTERM` the worker finishes the jobs in hand (up to 60 seconds). More workers share the load.

### B. Plans and billing

Free, Pro and Business plans (`src/config/plans.ts`), with limits on rooms, experiences, members and AI. Hosts pay
**instantly only**: by card (Stripe subscription) or by Whish (one month at a time). There is no paying by hand, no
receipt upload and no admin approval; do not build one. Plan payments and sponsored listings ("F. Featured
partners and sponsored listings") are the platform's only income. Code: `billing-service.ts`.

| Plan     | Per month | Rooms     | Experiences and services | Team (owner included) | AI  |
| -------- | --------- | --------- | ------------------------ | --------------------- | --- |
| Free     | $0        | 3         | 1                        | 2                     | no  |
| Pro      | $10       | 15        | unlimited                | 10                    | yes |
| Business | $20       | unlimited | unlimited                | unlimited             | yes |

- **Limits:** `assertPlanAllowsAnother(businessId, "rooms" | "offerings" | "members")` before adding one. Deleted
  rooms and experiences and removed members do not count. Inviting and joining a team call it (joining checks
  again, before any account is created). `createRoom` (room-service) and creating an experience or service call it
  too.
- **Owners only** start a checkout or open the portal (`requireOwner`); `getBilling` needs `settings.manage`.
- **Card (Stripe):** `POST .../billing/checkout` returns Stripe Checkout; the plan only changes when the signed
  webhook (`POST /api/webhooks/stripe`) says so. Each event is recorded in `WebhookEvent` in the same transaction
  that applies it, so a replay changes nothing and a failure leaves nothing (Stripe retries). Paid invoices are
  recorded as `PlanPayment` rows. A paying business changes plan in the portal (`POST .../billing/portal`).
- **Whish:** `POST .../billing/whish` writes a `PENDING` plan payment, then asks Whish for the payment page; if
  Whish refuses, the row is marked `FAILED`. Whish's callback (`GET /api/payments/whish/callback?plan=`) only makes
  us ask Whish for the real status; once paid, 30 days are added (following on from what is left of the same plan),
  once. Housekeeping re-checks pending Whish plan payments from the last day whose callback never came, and puts a
  business whose Whish month ran out back on Free.
- **Simulator:** with `WHISH_MODE=simulator` the Whish client talks to `/api/whish-simulator/*` inside the app
  (Whish v1.4.4). Phone 96170123456 and code 111111 pay; any other code is a failed attempt.

### B. Bookings: the statuses

| Status             | Meaning                                  |
| ------------------ | ---------------------------------------- |
| `HELD`             | A request waiting for the host           |
| `AWAITING_PAYMENT` | Accepted, waiting for the online payment |
| `CONFIRMED`        | Confirmed                                |
| `DECLINED`         | The host said no                         |
| `EXPIRED`          | Nobody answered or nobody paid in time   |
| `CANCELLED`        | Cancelled by the guest or the host       |

- The first three hold the nights (`ACTIVE_BOOKING_STATUSES`).
- The first two end when their time runs out (`EXPIRING_BOOKING_STATUSES`).
- Allowed changes are in `booking-status.ts` (`assertTransition`). Any other change gives a 409 error.

### B. Bookings: where a new booking starts

`booking-policy.ts` has simple functions with no database:

| Business's mode          | New booking starts as | Then                                                      |
| ------------------------ | --------------------- | --------------------------------------------------------- |
| 1. Automatic             | `AWAITING_PAYMENT`    | `CONFIRMED` when paid                                     |
| 2. Online, with approval | `AWAITING_PAYMENT`    | `HELD` when paid, then `CONFIRMED` or `DECLINED` by owner |
| 3. Offline               | `HELD`                | `CONFIRMED` or `DECLINED` by the owner                    |

`holdUntil` sets the deadline: 10 minutes to pay, and the business's `holdHours` for the owner to answer. When a
paid booking expires because the owner did not answer, the guest is refunded in full.

### B. Bookings: asking for a stay (safe against races)

A "race" is when two guests ask for the last room at the same moment. `requestBooking` in `booking-service.ts`
handles it:

1. Check the dates: at least 1 night, at most 60, not in the past, at most 540 days ahead.
2. Find the business by its slug (404 if none).
3. In one transaction:
   - lock the room row, so requests for one room take turns,
   - check the room fits (guests, minimum nights),
   - expire this room's old holds,
   - refuse nights already taken on Airbnb or Booking.com,
   - calculate the price,
   - save the booking and its `DIRECT` occupancy,
   - log the action.
4. If the database refuses the overlap, answer 409 "Those dates were just taken" (`overlapAsConflict`).
5. After saving, queue the notifications (`notify` queue).

### B. Bookings: the host decides

- `confirmBooking` (modes 2 and 3) first reads the room's Airbnb and Booking.com calendars again
  (`refreshRoomFeeds`). Then it confirms.
- `declineBooking` and `cancelBooking` refund everything the guest paid online.
- All three lock the room, check the status change, keep the occupancy's `active` flag correct (`changeStatus`),
  save who decided and when, log the action and tell the guest.

### B. Bookings: the guest cancels

Signed in, from their booking (`POST /api/public/bookings/{token}/cancel`; the link opens only for the guest who made
it), while the booking is held or confirmed, and before check-in. If the booking was paid online, the guest is refunded in full.

### B. Bookings: holds that run out

- Each new request on a room expires that room's old holds.
- The scheduled job `/api/cron/expire-holds` expires the rest every few minutes (unpaid bookings after 10
  minutes, unanswered ones after `holdHours`, with a full refund when paid).
- It uses one database update that checks the status again, so a hold confirmed a moment earlier is never touched.

### C. The calendar board

Page: `/dashboard/{id}/calendar`. Views: month, week and rooms.

- Colours by kind: our bookings, closed by the host, from a platform.
- Bookings waiting for an answer or payment have stripes.
- Clashes have a red outline.
- Click a day to see arrivals, departures, stays and free rooms.
- Click a stay to see its details.
- Double-click a day (or press "Close dates") to close nights.

Code: `calendar-board.tsx` (views, selecting), `calendar-side-panel.tsx`, `close-dates-form.tsx`,
`calendar-model.ts` (types and date helpers).

### C. Closed dates (blocks)

`addBlock` and `removeBlock` in `calendar-service.ts` (no moving by drag and drop). A block is a `MANUAL` occupancy, so the database
refuses it on taken nights (409 "Those nights are already booked or blocked"). Hosts also use blocks for bookings
taken by phone.

### C. Calendar sync: reading Airbnb and Booking.com

```
CalendarFeed (room, link, source)
  │  every 15 minutes (worker) · when the host presses "Sync now" · just before a host confirms
  ▼
download: https only, public addresses only, no redirects, 10-second limit, 2 MB limit   (ical/safe-fetch.ts)
  ▼
read: each event becomes [checkIn, checkOut) in the place's time zone;
      skip cancelled, past, more than 540 days ahead, and events with no id              (ical/parse-feed.ts)
  ▼
in one transaction, with the room locked:
  save IMPORTED occupancies by (feedId, externalUid)   reading again never makes copies
  turn off rows whose event disappeared                  a platform cancellation frees the nights
  re-flag the room's imported rows: conflict = active AND overlaps our active DIRECT or MANUAL rows
  log each flag that changed to the bell (calendar.conflict / calendar.conflict_resolved)
then email and push the hosts about each NEW clash, and save lastSyncedAt and lastError
```

- Imported rows are **not** under the overlap rule (its `WHERE` is `active AND kind <> 'IMPORTED'`), because Airbnb
  and Booking.com can overlap each other, and Airbnb can send a booking over nights we already sold (it refreshes
  only every few hours). So a clashing import is **stored as a normal active row with `conflict = true`**, never in
  a separate table and never as inactive: it is a real guest, and its nights must stay blocked. Direct requests are
  checked against imported rows in code, with the room locked.
- `(feedId, externalUid)` is unique, so a refresh never makes copies.
- Nothing is cancelled automatically. The host decides which booking to cancel.
- The host hears about a clash **once**, when its flag turns on: a bell entry, an email and a push to everyone who
  can decide bookings (`notifyImportConflict`). When it clears, the bell says so and the red outline goes.
- A clash clears **at once** when our side changes, not at the next sync: deciding or cancelling a booking, a guest
  cancelling, a hold expiring, and adding or removing closed dates all call `recheckImportClashes` for the
  room after they commit. When the platform cancels, the next sync turns the imported row off and clears the flag.
- A stay that simply ended and left the feed is not announced as "cleared".
- If a link fails, nothing already imported changes.

### C. Calendar sync: our calendar link

Each room shares `GET /api/ical/{exportToken}`:

- our `DIRECT` and `MANUAL` nights from today,
- the only text is "Not available" (no guest details),
- no imported nights (that would create loops),
- event ids never change (the platforms track events by id).

An unknown link answers 404.

### C. Categories

Browse categories (mountain, beach, hiking…) managed by admins, each for homes, experiences or services. A category's
slug and kind never change, because links use them.

### C. Contact the host

A guest can email a host from the place page (`POST /api/public/places/{slug}/messages`). It is rate limited. The
guest's email is the reply address. A host can turn it off and offer WhatsApp only.

### D. Dashboard overview

`/dashboard/{id}`: arrivals and departures today, waiting requests, upcoming bookings, the channels of the last 90
days, and the money saved. An owner with several places also sees them all together.

### D. Design system

The full design system (every colour of every palette, fonts, text sizes, spacing, containers, components) and
every page with its sections are in `08-design-system-and-pages.md`. The short version:

The product looks and works exactly like the reference project:

- the same themes: five colour palettes (chosen by the platform admin), plus light and dark for each visitor,
- the same tokens, components, layouts and interactions.

New screens are built from these pieces. Nobody invents colours, fonts, spacing or new component styles.

- Every colour, corner radius, shadow and animation curve is a **token** in `src/app/globals.css`, shared with
  Tailwind through `@theme`.
- Components use token classes only: `bg-surface`, `text-muted`, `ring-line`, `bg-accent text-accent-ink`,
  `bg-danger text-danger-ink`, `backdrop:bg-scrim`. Never raw colours.
- The only fixed colours are other companies' brands (`brand-whatsapp`, `brand-airbnb`, `brand-booking`,
  `brand-messenger`, `brand-facebook`, `brand-x`), only for their logos.

Shared pieces:

- `Button` and `ButtonLink` (styles: primary, secondary, ghost, danger; sizes: sm, md, lg, icon),
- `Field`, `TextArea`, `LabeledControl`, `FormError`, `useConfirm`, `SheetDialog`, `Skeleton`, `PageHeader`, `Panel`,
- class names: `inputClass`, `panelClass`, `choiceChipClass`, `labelledControlClass`.

### E. Emails

- Resend sends the emails (`src/server/email/send.ts`).
- One HTML template (`templates.ts`). Guest text is made safe. Arabic is right-to-left.
- Each email is in the reader's language.
- Without an API key, emails are printed in the log.
- Addresses on reserved test domains (`.test`, `.example`, `.invalid`, `.localhost`) are never sent to, because they
  can never receive email. The demo accounts (`host@mabeet.test`) use them.
- Emails only reach other people's inboxes after the sending domain is verified on Resend.

### E. Experiences and services

Hosts can sell seats in dated sessions (a hike, a wine tasting, an airport transfer).

- The `session_seats_guard` trigger locks the session and refuses selling too many seats. If 20 guests race for the
  last 5 seats, exactly 5 get one.
- Same statuses, rules and payments as stays.

Code: `offering-service.ts`, `session-booking-service.ts`.

### F. Favourites

Signed-in guests can save places. Code: `favorite-service.ts`, `src/app/actions/favorites.ts`.

### F. Featured partners and sponsored listings

Bonus (F23), built on "N. Near your stay".

- **Partner places** are places near guesthouses that are not on the platform: restaurants, supermarkets, parks,
  museums. Their kinds are a list in `src/config/partner-kinds.ts`. Platform admins add them at `/admin/partners`
  with a region, a map pin, a photo, a link and a phone. They are never booked through us.
- **Sponsored listings:** an admin can sponsor a partner place, or an experience or service of the platform, for a
  set of dates (`partner-service.ts`; only platform admins). While sponsored, it comes first in "Near your stay" and
  always shows a "Sponsored" label. A guest never sees a sponsored item without that label.
- Partners are soft-deleted like every business table, and every admin change is logged.
- This needs tables that do not exist yet: the database keeper adds them first (`07`, "Waiting for the database
  keeper").

### H. Host profile

The owner's own profile (name, bio, city, languages, years hosting, how guests may contact them). It shows on their
listings only if they choose. Code: `host-service.ts`.

It has **no phone or WhatsApp number**. The numbers guests use are always the **business's** (`Business.whatsapp`
and `phone`), the same on the place page and the booking page. The host's own number is `User.phone`, for the
platform admins.

### L. Languages

- `messages/en.json`, `ar.json` and `ar-LB.json` hold every text on screen.
- A unit test fails if a key is missing or empty in any file.
- Arabic pages are right-to-left.
- Server error messages are translated by `localizeError`.
- In components use `useTranslations("namespace")`. On the server use `getTranslations`.

### M. Money: guests paying online

1. `startBookingCheckout` creates a pending payment and returns the Whish or Stripe payment page.
2. When Whish calls us back, or the guest comes back, we only run `settleOnlinePayment`.
3. `settleOnlinePayment` asks Whish or Stripe what really happened. Their answer decides. So a fake callback cannot
   confirm a booking.
4. Marking a payment as paid happens only once, in a transaction. Calling it many times changes nothing.
5. If a payment arrives after the booking ended, it is refunded in full automatically.
6. A scheduled job checks payments still pending after 2 minutes.

### M. Money: refunds

`refundForEndedBooking(endedBooking, by, now)`:

- Whoever ends the booking (guest, owner, platform, or the clock): full refund, automatically.
- Card refunds go through Stripe. Whish refunds go through Whish.
- If an automatic refund fails, it shows on the admin page to send by hand (`Refund.automatic`, `PENDING`).

### M. Money: payouts to hosts

- Online money is held for the host.
- The owner sees how much is available and asks for a payout to a Whish number or a bank account (IBAN). Never card
  numbers.
- An admin sends it by hand from the platform's Whish or Stripe account, and marks it sent with the transfer
  reference.
- The business row is locked, so two requests cannot spend the same money.

### N. Near your stay (things to do nearby)

Bonus (F22), needs experiences and services (F8).

- On a place's page, once the guest picks dates, and on the guest's booking page, `NearbySection` shows experiences
  and services in the same region with a session during the guest's nights, nearest first (from the map pins).
- `listNearbyOfferings(placeId, range, now = new Date())` in `offering-service.ts` reads only public, active,
  not-deleted offerings and sessions with free seats; route `GET /api/public/places/{slug}/nearby?checkIn=&checkOut=`.
- It uses the region (`src/config/regions.ts`), the map pin and the `OfferingSession` dates that already exist; no
  database change.
- With F23, sponsored offerings and partner places come first ("F. Featured partners and sponsored listings").

### N. Notifications

- Hosts and staff who can decide bookings hear about new requests and guest cancellations, and about a platform
  booking that clashes with nights already sold (once, when the clash appears; see "Calendar sync").
- Guests hear about every status change.
- A person invited to a team gets the invitation email with its link (`/invite/{token}`), in the language the host
  used; the host who invited them hears when they join. An invitation cancelled or run out before the job runs
  sends nothing.
- Each notification is an email and a push notification to every device the person turned on.
- Everything is queued on the `notify` queue after saving, and never throws an error. The worker sends it and
  retries a failed delivery up to 4 times; emails carry an idempotency key, so a retry never sends one twice.

Code: each module's `<module>-notifications.ts` (for example `src/modules/team/server/team-notifications.ts`),
the shared helpers in `src/server/email/notices.ts`, and `push-service.ts` in `notifications`.

To add a notice, add it to the notifications file of the module that owns the event, copying an existing one
(for example `notifyInvitation`):

- An exported `notifyX(id, …)` that only calls `queueNotice(job, data)`. Data holds ids and plain values.
- `defineJob("notify", "notify.x", handler)`. The handler loads the rows fresh, and returns without sending when
  the news no longer holds (the booking was cancelled, the clash was settled), because the worker may run it later.
- The text in English and Arabic (`l === "ar" ? … : …`), as a `Letter`: `subject`, `idempotencyKey`, and a
  `message` with `kicker`, `title`, `body` paragraphs, `details` rows and one `action` button.
- `idempotencyKey` is unique per event, not per row, when the same thing can happen twice (add the time of the
  event), so a retry never sends twice but a second event still does.
- `tellHosts(businessId, build)` reaches the people who can decide bookings, one email per language plus a push to
  each of their devices; `tellGuest(notice, letter)` reaches the guest.
- If the file is new, list it in `src/server/jobs/registry.ts`.

### O. Creating a place

`POST /api/workspaces` creates a business with a unique slug (`uniqueSlug` in `src/utils/slug.ts`), its owner role
and default roles, and makes the user its owner. All in one transaction.

### P. Photos

JPEG, PNG or WebP, up to 2.5 MB. The file's own bytes decide its type, not its name. Every upload is shrunk on our
server with `sharp` (at most 1600 pixels wide, WebP), so a photo is a few hundred KB and R2's free tier (10 GB) holds
tens of thousands of them.

- **On the live site: Cloudflare R2 (free tier).** The WebP file goes to the public bucket under
  `StoredImage.storageKey` (uploaded with `aws4fetch`, R2's S3 API), and `Photo.url` is its address under
  `R2_PUBLIC_URL`, a custom domain on Cloudflare (the `r2.dev` address is rate limited, for development only). Guests
  load photos straight from Cloudflare, so they never cost our server or database anything. Files are named by a
  random key and never change, so they are cached forever.
- **On your computer and in tests (no R2 settings):** the bytes are kept in Postgres (`StoredImage.bytes`) and served
  from `/api/images/{id}`, cached forever.
- Nothing is deleted: removing a photo marks it `isDeleted`; its file stays in R2.

Code: `photo-service.ts`, `photo-repository.ts`.

### P. Places and rooms (public)

`directory-service.ts` is the public side:

- `searchPlaces`: filters and dates. It uses two availability queries for all results together, never one per place.
- `getPlace`, `checkAvailability`, `quoteRoom`, `getTakenNights`.

The website search, the guest's AI and the guest MCP all use it, so they always agree.

### P. Pricing

`quoteStay` in `pricing.ts`:

- each night's price (the room's base price, or that night's special price),
- the total (always what is paid online; there are no deposits).

Money is always whole cents, stored as `BigInt` and handled as a number (see "Rules for the schema").

### P. Push notifications and installing the app

The site can be installed on a phone. It has a manifest, icons and a service worker (`public/sw.js`) that shows
notifications. We only accept push subscriptions from real browser push services. A device always belongs to a
signed-in person (booking needs an account), and one browser endpoint is one row (`endpoint` is unique): subscribing
again replaces its keys, and someone else subscribing on the same browser takes it over. Pages are never served from the
cache, because availability must always be live.

### R. Reviews

Only a guest who stayed may review, only once, and only after check-out. A review is one overall rating (1 to 5) and
a comment; there are no sub-ratings (cleanliness, location, value). Owners can reply or hide a review with a reason.
A review whose author closed their account stays, without their name: closing an account keeps the user row (marked
deleted), so review reads show no name when `author.isDeleted` (F17). Code: `review-service.ts`.

### R. Rooms (dashboard)

Rooms with capacity, beds, base price, minimum nights, amenities, photos and special prices by date range. A place
can also be booked as a whole: one `WHOLE_PLACE` unit that takes turns with its rooms. Code: `room-service.ts`.

### S. Search and browse

The home page and `/search` list places, experiences and services with filters (area, dates, guests, price,
categories, amenities, accessibility). Filters come from the URL. Wrong filters are quietly ignored (`searchParams`
schema with `.catch`).

### S. Settings

Business settings: contact, currency, hold hours, commission rate, the booking mode (automatic, online with
approval, or offline; an online mode needs the owner to accept the payment policy first), and whether the place is
listed. Needs `settings.manage`. Code: `settings-service.ts`,
`settings-form.tsx`.

### T. Team and roles

Add a member by email with a role, change their role, or remove them. Create, change and delete roles. Only an owner
can make or change an owner. Nobody can change their own access. Code: `team-service.ts`.

---

## Part 8. How to build screens

### Server components first

- Pages are server components. They read data through services, using `requirePageTenant` or `requirePageAccess`
  (from `src/server/http/session.ts`). These show the 404 page to non-members.
- Pages pass plain data to client components.
- Add `"use client"` only when a component needs state, effects or click handlers.

### Calling the API from the browser

- Use `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`, `api.upload` from `src/lib/api-client.ts`.
- If a call fails, it throws `ApiError` with the server's message.
- Show it with `errorMessage(caught, fallback)` and `FormError`.
- Never call `fetch` directly.

### Shared hooks

- `useAction()`: calls the API, then refreshes the page. Gives `pending` and `error`.
- `useRedirectAction(fallback)`: for steps that end on another page (Stripe, Whish, an AI app's sign-in).
- `useStoredChoice(key, allowed, fallback)`: remembers a choice in this browser, such as the calendar view.
- `useConfirm()`: the "are you sure?" dialog, before anything that cannot be undone.

### Loading, empty and error states

- Every dashboard page has a `loading.tsx`, built from `components/shell/skeletons.tsx`, in the shape of the real
  page.
- Every list has an empty state with one clear next step.
- Every action shows errors with `FormError`.

### Phones first

Every screen works at 390 pixels wide with no sideways scrolling. On phones, the dashboard has a tab bar at the
bottom.

### Accessibility

- A real label on every input.
- Visible focus rings.
- `role="alert"` on errors (`FormError` does this).
- Buttons for actions, never clickable `div`s.

---

## Part 9. Scheduled jobs

| Job           | Worker schedule | Route (manual run)            | What it does                                                                                          | If it never runs                                                                              |
| ------------- | --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Calendar sync | every 15 min    | `POST /api/cron/sync-feeds`   | Reads up to 20 calendar links not read in 15 minutes                                                  | Calendars still update on "Sync now" and before each confirmation                             |
| Housekeeping  | every 5 min     | `POST /api/cron/expire-holds` | Checks pending online payments, expires unanswered and unpaid bookings, ends unpaid Whish plan months | Each new request expires its room's old holds; a returning guest's payment is checked at once |

The worker runs both on its own schedule (`src/modules/housekeeping/server/housekeeping-jobs.ts`), kept in the database so each run happens
once even with several workers. The routes need `Authorization: Bearer $CRON_SECRET`.
They are only for a manual or outside run: on DigitalOcean the worker runs every schedule itself.

---

## Part 10. Security

- Writes from other websites are refused. Sign-in cookies are `SameSite`.
- Every input is checked. Every query filters by `businessId`. Non-members get 404.
- Calendar links are only downloaded from public https addresses, with no redirects and with size and time limits.
  This stops "SSRF" (tricking our server into calling private addresses).
- Uploaded files are checked by their bytes. Push subscriptions only for real push services.
- API keys are stored as hashes and shown only once. Read-only keys lose every write permission.
- Raw SQL only with safe `$queryRaw` templates (values are never pasted into the SQL text).
- Webhooks (calls from Stripe) are checked by signature and applied only once.
- No secrets in the repository. Live secrets are in the DigitalOcean server's settings and in GitHub secrets.

---

## Part 11. Settings in `.env`

`src/server/env.ts` checks them when the app starts.

**Required:**

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (at least 32 characters)
- `BETTER_AUTH_URL`
- `CRON_SECRET` (at least 24 characters)

**For production:** `JOBS_MODE=queue` (the Docker image sets it), with a worker running.

**For tests:** `TEST_DATABASE_URL`.

**Optional (each one turns a feature on):**

- `DEEPSEEK_API_KEY`: our own AI model (last bonus). `AI_MONTHLY_BUDGET_USD`: its budget. The MCP needs neither.
- `RESEND_API_KEY` and `EMAIL_FROM`: emails.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`: card payments.
- `WHISH_MODE` (`simulator` by default), `WHISH_CHANNEL`, `WHISH_SECRET`, `WHISH_WEBSITE_URL`: real Whish.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: push notifications.

`.env.example` lists them all, empty.

---

## Part 12. Documents the brief asks for

- `README.md`: setup, architecture, key decisions, known limits.
- `docs/functional-requirements.md` and `docs/non-functional-requirements.md`.
- `docs/erd.md`: the database diagram, made from `prisma/schema.prisma` by `pnpm run docs`.
- `docs/openapi.json`: the API contract. Each route is written in it by hand, matching its Zod schema, until
  `scripts/openapi.ts` generates it from the schemas; `pnpm run docs` writes `docs/openapi.yaml` from it. A test
  (`tests/unit/openapi.test.ts`) will fail if a route is missing from it.
- `docs/architecture.md` and `docs/requirements-matrix.md` (each requirement, where it is built, and which test
  proves it).

---

## Part 13. Checklist for any new code

1. Is the code in the right module, and does other code reach it only through `index.ts` or `server.ts`? Is the rule
   in a service, the query in a repository, and the route short?
2. Does the service check the permission and filter by `ctx.businessId`?
3. Is every input checked by a schema in the module's `schemas.ts`?
4. Do lists of values come from `src/config/`, not typed by hand?
5. Are database refusals handled with `overlapAsConflict` or `duplicateAsConflict`?
6. Are small side writes (logs, usage) inside `inBackground`, and slow or must-happen work (AI, email, push) a job?
7. Does the screen use tokens and `components/ui/`, with loading, empty and error states, at phone width?
8. Is every new text in all language files?
9. Are the tests from `04-test-plan.md` written and passing?
10. Does `pnpm check` pass? Is a new or changed route written in `docs/openapi.json` (generated by `scripts/openapi.ts` once it exists), then
    `pnpm run docs`?

---

## Part 14. Contracts of the shared building blocks

A contract is the exact way to call a function: its name, what it takes in, and what it gives back. These are the
functions other features call. They do not change without a pull request announced on Discord. Build your feature
against these exact shapes, even before the function is merged.

### The booking engine (`src/modules/bookings/server/booking-service.ts`)

```ts
interface BookingRequest {
  businessSlug: string;     // the place's public slug
  roomId: string;
  range: DateRange;          // { checkIn, checkOut }, check-out night free
  guestCount: number;
  guestName: string;
  guestPhone: string;        // international format, +961...
  guestEmail: string | null;
  guestNote: string | null;
  guestUserId: string;       // the signed-in guest: booking needs an account
  locale?: string;           // the guest's language, for their emails
}

interface Decision {
  bookingId: string;
  reason?: string;
}

requestBooking(request: BookingRequest, now?: Date): Promise<Booking>
// Holds the room at once. Throws conflict (409) "Those dates were just taken" if the nights are taken.

confirmBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
declineBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
cancelBooking(ctx: TenantContext, decision: Decision, now?: Date): Promise<Booking>
// Need bookings.decide. Throw conflict (409) for a status change that is not allowed.

cancelStayAsGuest(publicToken: string, guestUserId: string, reason: string | null, now?: Date): Promise<Booking | null>
// The signed-in guest's own booking. Returns null for an unknown link or someone else's booking. Throws conflict
// (409) once the stay has started.

getBookingForGuest(publicToken: string, guestUserId: string): Promise<(Booking & { room; business; payments }) | null>

// Every function that frees or takes our own nights (decide, guest cancel, hold expiry, closed dates) calls
// recheckImportClashes(businessId, roomId) after it commits, so platform clash flags are right at once.
```

### Tenancy (`src/server/auth/tenant-context.ts`, `src/server/http/*`)

```ts
can(ctx: TenantContext, permission: Permission): boolean
requirePermission(ctx: TenantContext, permission: Permission): void   // throws forbidden (403)
requireOwner(ctx: TenantContext, refusal: string): void               // throws forbidden (403)

tenantRoute(paramsSchema, handler: ({ request, ctx, params }) => Promise<Response>)
// For /api/workspaces/[businessId]/**: 401 if not signed in, 404 if not a member.

requirePageTenant(businessId: string): Promise<TenantContext>          // pages: 404 page if not a member
requirePageAccess(businessId: string, anyOf: Permission[]): Promise<TenantContext>
```

### Permissions and roles (`src/config/permissions.ts`)

```ts
type Permission = "rooms.read" | "rooms.manage" | ... | "ai.use"   // the full list is in Part 5
ALL_PERMISSIONS: Permission[]
DEFAULT_ROLE_TEMPLATES   // the default roles (Manager, Front desk, Housekeeping), added when a place is created
// The owner role is made separately when a place is created: it has every permission and cannot be changed.
```
