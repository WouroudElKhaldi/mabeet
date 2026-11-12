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
  with OAuth (a safe sign-in for apps). Every new account confirms its email first (`requireEmailVerification`):
  sign-up sends "Confirm your email" with a button, shows "Check your inbox", and the session starts only once the
  link is opened; signing in before that sends a new link. Without `RESEND_API_KEY` the email, link included, is
  printed in the log.
- **Zod 4:** checks every input: API input, AI tool input, settings in `.env`, and answers from DeepSeek, Stripe and
  Whish.
- **next-intl:** English, Arabic and Lebanese Arabic. Arabic is right-to-left.
- **Tailwind CSS 4:** styling, using design tokens only.
- **MCP:** how AI apps (Claude, ChatGPT, Cursor, Codex) use our tools. The model runs in the person's own app.
- **DeepSeek:** our own AI model, for the last bonuses only (the dashboard assistant, the website travel
  assistant, the AI report). Changing to another AI provider means changing one file.
- **Vitest:** unit tests (no database) and integration tests (real database).
- **DigitalOcean with Docker:** hosting for the website and the PostgreSQL database, on one server (a droplet)
  behind nginx (`docs/deployment.md`). One Docker image runs twice: as the website (`pnpm start`) and as the job
  worker (`pnpm worker`). Real emails are sent with Resend from our own
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
- If the live site needs it, add its name to the deploy job's list in `.github/workflows/ci.yml` and its value to
  GitHub's `production` environment (`docs/deployment.md`). A service address such as `REDIS_URL` goes in
  `docker-compose.prod.yml` instead, pointing at the service by name. Only a setting the build itself checks needs a
  placeholder in the `Dockerfile` build step.
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

- A payment belongs to a booking. It is always online (Whish or Stripe). It has an amount, currency, method, status, and two provider
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
- `McpAuditLog`: every AI tool call (tool, result, time taken, channel: `mcp`, `chat` or `guest`). A guest MCP call has
  no place and no person. `getAiUsage` (`ai-usage-service.ts`, platform admins only) counts them by tool and channel
  for `/admin/ai-apps`.
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
the same dates; the booking API answers 401 to anyone not signed in, and 403 to an account whose email is not
confirmed (`requireVerifiedUser(request)` in the route; opening a place, `POST /api/workspaces`, asks the same). Every
`Booking` and `SessionBooking` has a required `guestUserId`, and a booking's page (`/b/[token]`) opens only for the
guest who made it.

Guests see their stays (`/account`), save favourites, review a stay after check-out, download all their data
(`GET /api/me/export`), and delete their account (`POST /api/me/delete`, typing their email to confirm; see "Nothing
is deleted"). Anyone with an account changes their own name and phone (`PATCH /api/me/profile`; the email is
how they sign in, so it stays) and their password (Better Auth's change password, which signs out their other
devices), on `/dashboard/[businessId]/profile` or `/admin/profile`. Code: `account-service.ts`,
`src/app/(site)/account/**`.

### A. Activity log and notification bell

Every important action is recorded, through the `audit` module (`@/modules/audit/server`):

- `recordAction(ctx, action, entity, entityId, tx)` for a team member's action, into `AuditLog`. Pass the change's
  transaction, so the change and its log line are saved together or not at all.
- `recordPersonAndBusiness(tx, { userId, businessId, action, entity, entityId })` for something a person did that
  the business must hear about (a guest's request, someone joining the team): it goes on the person's own timeline
  (`ActivityLog`) and in the business's `AuditLog`.
- `notePerson(tx, { userId, businessId, action, entity, entityId })` for what only the person's own timeline needs:
  a host's decision on their booking, a request that ran out, a place saved or unsaved (`favorite.saved`,
  `favorite.removed`, only when the heart really changes), a review written (`review.written`).
- Something the system noticed (a sync, a payment callback) goes in `AuditLog` with no actor; the audit module
  exports a function for it with the first such event.

The guest's Activity page (`/account/activity`) reads the timeline through `listMyActivity(userId)` (`directory`
module, `activity-service.ts`): the newest 100 entries (`listPersonActivity` in `audit`), each with the place's
name and where it leads (the booking's page for a stay, found through `listMyBookings`; the place's page
otherwise, through `listPlacesByIds`). A place that has closed since keeps its line without a name or link. Only
the kinds in `src/config/activity.ts` are shown; a new kind needs a line there, its icon and text key in
`activity-list.tsx` and its text in the three message files. Test: `activity.integration.test.ts` (directory).

The bell in the top bar shows the last five events of the business. "View all" opens the full list. Code:
`audit.ts` (the feed reads `listFeed`, `countFeed`, `countFeedSince`), `notification-feed-service.ts` in
`notifications`, which reads them and when the person last looked (`notificationsSeenAt`, from `accounts`), and the
bell and list in `src/modules/notifications/components/`.

- The bell never reads the bookings: `notifications` may not call `bookings`, which calls it to send push. So the
  booking engine writes the guest and the reference on the log line itself (`note: { guest, reference }`, saved in
  `AuditLog.meta`), and the bell shows them from there.

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

`/admin`, for platform admins: businesses (suspend or reactivate; an owner's archived place shows "Archived"), hosts, AI spending against the budget, calendar
sync health, payouts and refunds to send by hand, plan offers, categories, and the
site's colour palette. Code: `src/app/admin/**`.

- Each admin read and change lives in the module that owns its table, never in `admin`: `workspaces` lists the
  businesses and suspends them (`platform-service.ts`), `billing` adds up the plan revenue (`plan-revenue.ts`),
  `payments` keeps the payout queue, `bookings` what each host is owed and the refunds to send by hand. `admin` keeps
  only its own tables: the categories and the site's palette. So `workspaces` can keep calling `admin` with no circle.
- Every one takes a `PlatformActor`, calls `requirePlatformAdmin` first, and logs its change with
  `recordPlatformAction` (`business.suspended`, `business.reactivated`, `business.plan_changed`, `category.created`,
  `category.updated`, `category.deleted`, `site.palette_changed`).
- **The admin's long lists** are read a page at a time by the module that owns the table, filtered in the query:
  `listPlatformHosts` (workspaces: name, email, phone or place; place status; plan), `listPlatformPeople` and
  `getPlatformPerson` (accounts: guest, team member, host or admin), `listPersonTripsForAdmin` (bookings: a
  person's latest stays), `listCategoryPage` (admin), `listOffersForAdmin` (billing), `listPartnerPage`
  (partners), `listPayoutRequests` and `listPayoutHistory` (payments: place or account name; how it is sent; sent
  or refused), `listRefundsToSend` (bookings: place, guest or booking reference) and `getSyncHealth`
  (calendar-sync: place or room name; source). Each returns `{ total, page, pages }` from `pageOf`
  (`src/utils/paging.ts`, 20 a page). `getHostBalances` (bookings) is the one list paged after it is worked out:
  balances are computed from payments, never stored, so it names each place with `listPlaceNames` (workspaces, any
  status), filters by that name and pages the result.
- **Setting a plan by hand:** `setPlanAsAdmin` (billing, `PATCH /api/admin/businesses/{businessId}/plan`) sets a
  plan until a last day (housekeeping ends it like a Whish month) or with no end. A place paying by card is refused:
  its plan follows Stripe, and the next webhook would undo the change.
- Suspending writes only `Business.status`: every public read and `resolveContext` already ask for `ACTIVE`, so the
  page, the listing and the team's access go at once, and come back with `ACTIVE`.
- A category's slug is its key: creating a deleted slug brings the row back. A category still used is never
  deleted.
- **The screens.** `src/app/admin/layout.tsx` checks `requirePageAdmin()` (`src/server/http/session.ts`) once and
  answers 404 to anyone else; each page calls it again for the `PlatformActor` its services need. The menu is
  `src/components/admin/nav-items.ts`. Pages: the overview, hosts (each owner once, with their businesses,
  `BusinessStatusToggle` and "Open dashboard"), one host (`/admin/hosts/{userId}`: their contacts, their host
  profile even while private, and each business with its size, "Open dashboard", its public page and the toggle;
  `getPlatformHost` in `workspaces`), people, money (`PayoutDecision`, what each host is owed,
  `RefundSent`, plan revenue by month), plan offers (`OfferManager`, "Plans and billing"), categories (`CategoryManager`), appearance (`SitePalettePicker`) and health: the calendar links
  that need a look across the platform (`getSyncHealth` in `calendar-sync`). A link needs a look when its last read
  failed or nothing was read for an hour (`feedNeedsLook`, `src/modules/calendar-sync/feed-health.ts`); the host's
  Channels page uses the same rule. Each
  component lives in the module whose route it calls.

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
- **Then: a few actions** (built, see below), only what the person's role allows: `cancel_booking` (full automatic refund),
  `close_dates` and `reopen_dates`, `confirm_booking` and `decline_booking`. Each calls the same service as the
  dashboard button. Keys can then have write access; read-only keys never see these tools. They are marked as
  changing data, so the AI app asks the person before running them. Marking a guest as arrived needs a new booking
  state from the database keeper first.
- Every tool can take an optional `place`, to work in another of the person's businesses (`resolvePlaceContext`). It
  only allows places the person belongs to. If a name fits several places, it refuses.
- Every call is logged in `McpAuditLog`. The key's "last used" time is updated after the answer (`touchKey`).

**What exists today** (`src/modules/assistant/server/`): personal keys (`api-key-service.ts`: `createKey`, `listKeys`,
`revokeKey`, all under `ai.use`; routes `GET`/`POST /api/workspaces/{id}/keys` and `DELETE .../keys/{keyId}`). A key
is `mbt_` and 32 random bytes; only its SHA-256 hash is stored, and the secret is shown once, when it is made. It is
the member's own (nobody else lists or revokes it), read only, 90 days unless chosen (or never), and a platform admin
visiting a business cannot make one. `authenticateKey` turns a key into the member's context (`channel: "mcp"`,
`readOnly`) only while the same membership is active, so a removed member's keys stop at once, and revoked or expired
ones too. `POST /api/mcp` (`answerHostMcp`, `host-mcp.ts`): 401 without a working key, 60 calls a minute per key,
the tools of `teamToolsFor(ctx)` (`team-tools.ts`): `list_places`, then `list_rooms`, `check_availability`
(`findFreeRooms`), `get_calendar` and `list_bookings`, each with the optional `place` (`resolvePlaceContext`: by
id or one name; several matches are refused) and filtered by the member's permissions there. Guests' names and notes
come as `{ guestWritten }`. `toolCallRecorder` writes each call to `McpAuditLog` in the background; the guest MCP logs its calls too, as
channel `guest` with no place. `get_report`
(`getBusinessReport`, the last 30 days unless given) and `get_savings` (`getSavings`) need `analytics.read` and give
the same numbers as the analytics page. Tests: `mcp-isolation.integration.test.ts` and
`mcp-oauth.integration.test.ts` (assistant).

**The actions** (`ACTION_TOOLS` in `team-tools.ts`, all `mutates: true`). A key is read only unless the member ticks
"Allow changes" when making it (`keyInput.canWrite`, stored as `ApiKey.canWrite`); signing in with OAuth stays read
only. A read-only key is never offered an action (`teamToolsFor`), and a member is offered only those their role
allows there. Each takes the optional `place` like the reading tools:

- `confirm_booking` (`bookings.decide`): `confirmBookingByReference`, the dashboard's confirm.
- `decline_booking` and `cancel_booking` (`bookings.decide`): `endBookingByReference`
  (`bookings/server/ai-booking-decisions.ts`). A booking nobody paid online for ends at once. One with an online
  payment ends only after every check, in this order: the member is an owner; the stay starts more than two days
  from now; the first call only answers what would happen (the refund, formatted) and the second must repeat that
  exact refund as `confirmRefund`; the payment is in one currency and not refunded yet; what Mabeet holds for the
  place, and for every place together, still covers the refund (`moneyFreeForRefunds` in `host-money-service.ts`:
  payments net of refunds, minus payouts sent or asked for); for a card payment, Mabeet's Stripe balance in that
  currency covers it too (`getStripeAvailableCents`, and a card refund is refused while it cannot be read); and at
  most three such refunds a day per place (`enforceRateLimit`). A refusal is logged as
  `booking.ai_refund_refused.<check>` and the member is only told to use the dashboard: the company's figures never
  reach a host or an AI app. Then the dashboard's own decline or cancel runs, with its full refund.
- `close_dates` and `reopen_dates` (`blocks.manage`): `addBlock` and `reopenNights`. Reopening frees every closed
  night in the days asked, even part of a longer block: a block reopened at one end is trimmed, one reopened in the
  middle is split in two, and the tool says what it reopened and what stays closed beside it. Bookings and platform
  stays are never touched.
- `set_room_open` (`rooms.manage`): `updateRoom` with `active`.
- `sync_calendars` (`feeds.manage`): `syncFeedNow` for every connected calendar link of the place.

A room is named by its id or (part of) its name; a name that fits several rooms is refused. Tests:
`mcp-actions.integration.test.ts` (assistant).

**OAuth sign-in** (for ChatGPT, Claude.ai and any app that connects without a key). Better Auth's `jwt` and
`oauthProvider` plugins (`src/server/auth/better-auth.ts`) make Mabeet the app's sign-in server. The app finds it
from the 401 of `POST /api/mcp` (`WWW-Authenticate: Bearer resource_metadata=…`), then
`/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`, registers itself (with PKCE)
and sends the person to sign in. After signing in, `/oauth/workspace` asks which place (only places where they hold
`ai.use`, `listConnectableWorkspaces`); `POST /api/oauth/workspace` keeps it on the sign-in session
(`Session.mcpBusinessId`), and `/oauth/consent` shows what the app asks for. The consent is saved for that place
(`OauthConsent.referenceId` is the business id) and the access token carries it as `business_id`. Only one access
scope exists, `mcp:read`: tokens are read only, like keys. `MCP_RESOURCE`, `MCP_READ_SCOPE` and `mayConnectAi`
live in the shared kernel (`src/server/auth/mcp-oauth.ts`) because Better Auth's setup needs them; the rest is in
the assistant module. `authenticateMcpCaller` (`mcp-token.ts`) takes a key (`mbt_…`) or verifies the token
(signature, issuer, audience `/api/mcp`, scope), and `contextForToken` (`mcp-oauth-service.ts`) then checks on
every call that the member is still on the team with `ai.use` and that the consent still exists: tokens are signed,
not stored, so this is what makes leaving or disconnecting work at once. The Connect AI page lists the member's
connected apps (`listConnectedApps`) and disconnects one (`DELETE /api/workspaces/{id}/connected-apps/{connectionId}`,
`disconnectApp`: its consent and tokens are deleted, and the action is logged). The access is not tied to a plan,
like keys: the person's own AI app brings the model.

### A. AI: the guest's assistant and guest MCP

- For AI apps: `POST /api/mcp/guest` (public), built first.
- On the website: `/assistant`, `POST /api/assistant`, answered by our own model (last bonus).

Both use the read-only `GUEST_TOOLS`: search places, check availability, get a place, search experiences, get an
experience. They only see public data. They give a link to the booking page. They never book: booking through
an AI is cut.

**What exists today** (`src/modules/assistant/server/`): `tool.ts`, `run-tool.ts` and `mcp-server.ts` as above, and
`guest-tools.ts` with `search_places` (`searchPlaces`: every part of the wish as a filter, the matching rooms with
their layout, and a booking link with the stay already picked; up to 20 places, with `moreMatch` true when more match,
so the guest's AI narrows the search instead of calling it again and again), `check_availability`
(`checkPlaceAvailability(slug, { range, guests })` in `directory`: each unit the place is booked by, free or not, the
stay's price, and the `stayIssue` code when the stay does not fit it) and `get_place` (`getPlace`: public fields,
the units, how booking and paying work in the place's mode, the full refund rule, and the host as the place's Meet your
host section shows them: their name, about, languages, years hosting and how quickly they answer only when they show
their profile, and only the ways to reach them they offer, the place's WhatsApp and its Contact host page). The experience tools come with
experiences (F8). `answerGuestMcp(request)` (`guest-mcp.ts`, the module's `server.ts`) serves them at
`POST /api/mcp/guest`: no sign-in, 30 calls a minute from one address, `GET` and `DELETE` answer 405 (stateless).
Links are absolute (`BETTER_AUTH_URL`), so the guest's AI app can show them. Tests: `mcp-server.test.ts` (marks,
context, safe errors, money formatted) and `guest-mcp.integration.test.ts` (search, 20 at a time and `moreMatch`, dates, a place and its host, nothing
private, the rate limit).

The place cards under a reply are built from the tool results, not from the model's words. So the model cannot
invent a place.

The page `/assistant` (built with the guest MCP; there is no chat on the website) tells guests what MCP is, why and how to connect Claude or ChatGPT, and shows the guest
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

**What exists today** (`src/modules/analytics/server/analytics-service.ts`). The night and booking sums live in
`bookings`, which owns those tables (`booking-stats-repository.ts`, raw SQL by business; `getStayNumbers`,
`getLifetimeDirectRevenue`, `getPlaceSnapshots` in its `server.ts`), so the `analytics` module has no database
code of its own: it reads them, the units (`countActiveUnits`, rooms), the places (`findPlacesForReports`,
workspaces) and the plan fees (`getPlanFeesPaid`, billing). A night counts as sold when it is a confirmed direct
stay, closed by the host or imported, on a unit of the kind the place is booked by, out of the live units of that kind
times the nights of the period. `getBusinessReport(ctx, range)` (`analytics.read`): occupancy, nights sold,
direct revenue (confirmed stays, for their nights inside the period), average price per direct night, commission
saved (revenue × the place's rate), channels, nights by month, requests by outcome, typical answer time.
`getSavings(ctx)`: since the place joined, per currency, and the plan fees paid. `getAnalytics(ctx, scope, range)`:
one place or every place the member may read, with totals (money per currency). `getPlacesOverview(userId)`: each of
the person's places with today's numbers where they may read bookings. Route: `GET /api/workspaces/{id}/analytics`
(`from`, `to`; the last 30 days by default, two years at most). The rating is on the Reviews page, not here.
Tests: `analytics.integration.test.ts` (analytics).

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
    calendar sync runs beside it (`cron.calendar-sync`, every 5 minutes, reading links not read in 10).
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

- **Limits:** `assertPlanAllowsAnother(businessId, "rooms" | "offerings" | "members", tx)` inside the transaction that
  adds one: with `tx` it locks the business first, so two additions at the same moment cannot both take the last
  place. The whole-place unit is the place itself, so it never counts. Deleted
  rooms and experiences and removed members do not count. Inviting and joining a team call it (joining checks
  again, before any account is created). `createRoom` (room-service) and creating an experience or service call it
  too.
- **Owners only** start a checkout or open the portal (`requireOwner`); `getBilling` needs `settings.manage`.
- **Another place, from the dashboard:** "Add a place" in the place switcher and on "All my places" opens
  `NewPlaceForm` in a pop-up (name and town only). It creates the place on Free and goes straight into its guided
  setup; the plan pitch of `/host` is for new hosts only. Each place has its own plan.
- **Getting a new place ready:** `getSetupChecklist` (rooms) works out each step of `SETUP_STEPS`
  (`src/config/setup.ts`) from what is saved, so a step ticks itself wherever it is done. Until the place is listed,
  its home shows `SetupChecklist`, each step leading to its screen of the guided setup. The guided setup
  (`/dashboard/{id}/setup?step=`, `SETUP_SCREENS`) asks one question a screen, through the same forms as the place's
  pages (`PlaceEssentials` with `ask`, `SettingsForm` parts `profile`, `payments` and `contact`, `PhotoManager`,
  `RoomEditor`), and ends on the checklist with "Publish". `StepFlow` (`src/components/ui/step-flow.tsx`) wraps each
  screen in `FormStep` (`form-dialog.tsx`): the form calls `useCloseDialog()` once saved, which here moves on, and
  its button says "Save and continue" (`useSubmitLabel`). A new place on Free, from `/host` too, lands on it.
- **Choosing a plan before there is a business:** `/pricing` sends a paid plan to `/host?plan=PRO` (checked with
  `paidPlan`), where it can be changed in place (each plan is its own address). A signed-out visitor keeps it
  through sign-up or sign-in (`?next=`). `CreateWorkspaceForm` creates
  the workspace (`POST /api/workspaces`, always on Free), then calls the same checkout route by card or Whish for
  the new business, offering only the ways `planPaymentMethods()` says are on. The plan starts when the payment is
  confirmed, as above. If paying fails, trying again only pays (the workspace is not created twice), and "Start on
  Free for now" goes to the dashboard. With no way to pay switched on, the workspace simply starts on Free.
- **Card (Stripe):** `POST .../billing/checkout` returns Stripe Checkout; the plan only changes when the signed
  webhook (`POST /api/webhooks/stripe`) says so. Each event is recorded in `WebhookEvent` in the same transaction
  that applies it, so a replay changes nothing and a failure leaves nothing (Stripe retries). Paid invoices are
  recorded as `PlanPayment` rows. A paying business changes plan in the portal (`POST .../billing/portal`).
- **Whish:** `POST .../billing/whish` writes a `PENDING` plan payment, then asks Whish for the payment page; if
  Whish refuses, the row is marked `FAILED`. Whish's callback (`GET /api/payments/whish/callback?plan=`) only makes
  us ask Whish for the real status; once paid, 30 days are added (following on from what is left of the same plan),
  once. Housekeeping re-checks pending Whish plan payments from the last day whose callback never came, and puts a
  business whose Whish month ran out back on Free.
- **Plan offers:** a platform admin gives hosts a paid plan free (`FREE`) or a share off its price (`PERCENT_OFF`,
  1 to 99 %), for every place or one place, either for each place's first months (1 to 24, counted from the day it
  joined) or between two dates (both days included; `endsAt` is the day after the last one). Code: `offer-service.ts`
  and `src/modules/billing/offers.ts` (`offerWindow`, `offerMonthlyCents`, pure, so the billing page shows the price
  the checkout charges). Admin routes `GET`/`POST /api/admin/offers` and `DELETE /api/admin/offers/{offerId}` (ends
  it, logged `plan_offer.created` and `plan_offer.ended`); page `/admin/offers` (`OfferManager`). `getBilling`
  returns the offers open to the place now, shown above the plans (`PlanOffers`).
  - A **free** offer is taken by an owner (`POST .../billing/offers/{offerId}/claim`, `claimFreeOffer`): one
    transaction locks the business money, writes a `PlanOfferClaim` (unique per offer and place, so a second claim is
    409), and sets the plan until the offer ends for the place, the way a paid Whish month does, so the same
    housekeeping puts it back on Free afterwards. Months already paid on the same plan past that date are kept. A
    place paying by card, or on a bigger plan that is still running, is refused (409).
  - A **percent-off** offer needs nothing from the host: the Whish checkout charges the lower price and stores
    `PlanPayment.offerId`; the card checkout first creates a one-use Stripe coupon (`createPlanCoupon`, repeating for
    the months the offer has left, rounded up) and passes it as `discounts[0][coupon]`. With two offers on the same
    plan, the larger share wins.
  - Ending an offer hides it at once. What it already gave stays: a free plan taken runs to its end, a discounted
    payment is paid.
- **Simulator:** with `WHISH_MODE=simulator` the Whish client talks to `/api/whish-simulator/*` inside the app
  (Whish v1.4.4). Phone 96170123456 and code 111111 pay; any other code is a failed attempt. Its API (create,
  status, refund) answers only this server's own client: the `secret` header must be `simulatorSecret()`, made from
  `BETTER_AUTH_SECRET`, so nobody outside can create, read or refund simulated payments. The payment page stays public.
  Anyone can still "pay" with the test code, so the simulator, like Stripe's test mode, must give way to the real keys
  before the site takes real bookings.

### B. Bookings: the statuses

| Status             | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `HELD`             | Waiting for the owner's answer (mode 3, or mode 2 once paid)       |
| `AWAITING_PAYMENT` | Waiting for the guest's online payment (10 minutes, modes 1 and 2) |
| `CONFIRMED`        | Confirmed                                                          |
| `DECLINED`         | The host said no                                                   |
| `EXPIRED`          | Nobody answered or nobody paid in time                             |
| `CANCELLED`        | Cancelled by the guest or the host                                 |

- The first three hold the nights (`ACTIVE_BOOKING_STATUSES`).
- The first two end when their time runs out (`EXPIRING_BOOKING_STATUSES`).
- Allowed changes are in `booking-status.ts` (`assertTransition`). Any other change gives a 409 error.
- The owner confirms or declines only a `HELD` booking (`assertOwnerCanAnswer`): one still waiting for its
  payment is the payment's to decide.
- A status change applies only if the booking is still in the status it was read in, so the clock expiring a hold
  and the owner answering it at the same moment never overwrite each other ("This booking just changed").

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
  (`refreshBeforeConfirming`, in `feed-sync-service.ts`). Then it confirms, unless a platform stay now
  covers those nights or the answer time ran out.
- `declineBooking` and `cancelBooking` refund everything the guest paid online. `cancelBooking` is refused once the
  stay has started (its money may already be paid out).
- All three lock the room, check the status change, keep the occupancy's `active` flag correct (`changeStatus`),
  save who decided and when, log the action and tell the guest.

The dashboard's routes, each a thin call to one of these services (`tenantRoute`, so a non-member gets 404):

| Route                                                                             | Service                                             | Needs                                 |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| `GET /api/workspaces/{businessId}/bookings` (status, room, dates, `take`, `skip`) | `listBookings`                                      | `bookings.read`                       |
| `GET .../bookings/{bookingId}`                                                    | `getBooking`                                        | `bookings.read`                       |
| `POST .../bookings/{bookingId}/{confirm\|decline\|cancel}` (optional `reason`)    | `confirmBooking`, `declineBooking`, `cancelBooking` | `bookings.decide`                     |
| `GET .../bookings/{bookingId}/payments`                                           | `listBookingPayments`                               | the owner (money is not a permission) |
| `GET .../calendar` (`from`, `to`, `roomId`; six weeks from today by default)      | `getCalendar`                                       | `calendar.read`                       |
| `POST .../blocks`, `DELETE .../blocks/{blockId}`                                  | `addBlock`, `removeBlock`                           | `blocks.manage`                       |

A guest's phone and email come back masked to a member without `guests.contact`. Tests:
`host-routes.integration.test.ts`.

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

Code (in `src/modules/bookings/`): `components/calendar-board.tsx` (views, selecting), `calendar-side-panel.tsx`,
`close-dates-form.tsx`, and `calendar-model.ts` (types and date helpers). The page reads `getCalendarBoard(ctx, query)`:
the place's rooms by name (`listRoomNames` from `rooms/server`: switched-off rooms kept, their nights stay) with the
same nights as `getCalendar`, under `calendar.read` alone, so a member who may see the calendar sees the rooms on it.
`?month=2026-11` picks the month; the view chosen is kept in this browser.

### C. Closed dates (blocks)

`addBlock`, `removeBlock` and `reopenNights` in `src/modules/bookings/server/closed-dates-service.ts` (no moving by
drag and drop), under the same room lock as bookings. `reopenNights` frees a range of nights in one room whatever
blocks they belong to: each block it touches is kept inactive and the nights outside the range come back as new
blocks with the same note (closed 12 to 15 and reopened 14 to 15 leaves 12 to 14 closed; the middle leaves two). A block is a `MANUAL` occupancy, so the database
refuses it on taken nights (409 "Those nights are already booked or blocked"). Hosts also use blocks for bookings
taken by phone.

### C. Calendar sync: reading Airbnb and Booking.com

```
CalendarFeed (room, link, source)
  │  every 10 minutes (worker) · just before a guest books (unless read in the last 2 minutes)
  │  · just before a host confirms · when the host presses "Sync now"
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

- **Read as late as we can.** The platforms read our link only every few hours, so we read theirs often and just in
  time: the worker every 10 minutes, a guest's booking first (`refreshBeforeBooking`: unless read in the last 2
  minutes, 4 seconds at most), and a host's confirmation always (`refreshBeforeConfirming`). At a place that can
  also be booked whole, every unit's links are read. A stay sold there a moment ago then refuses the request instead
  of becoming a clash.
- **Who does what.** `src/modules/calendar-sync` keeps the links (`CalendarFeed`), downloads and reads them, and
  builds our file; it never calls the booking engine. `src/modules/bookings/server/feed-sync-service.ts` writes the
  `IMPORTED` rows under the room lock and serves the routes: `GET/POST /api/workspaces/{id}/feeds`,
  `DELETE .../feeds/{feedId}`, `POST .../feeds/{feedId}/sync` (all `feeds.manage`), `GET /api/ical/{token}`.
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

- our `DIRECT` and `MANUAL` nights from today, holds waiting for a payment or an answer included, so the platforms
  stop selling them at their next read; at a place that can also be booked whole, the nights of the units it takes
  turns with too (the whole place for a room, every room for the whole place),
- the only text is "Not available" (no guest details),
- no imported nights (that would create loops),
- event ids never change (the platforms track events by id).

An unknown link answers 404. The address may end in `.ics` (some platforms ask for it); the channels page shows it
that way.

### C. Categories

Browse categories (mountain, beach, hiking…) managed by admins, each for homes, experiences or services. A category's
slug and kind never change, because links use them.

### C. Contact the host (F2a)

A guest can ask a place's host a question from its Contact host page (`POST /api/public/places/{slug}/messages`, no
sign-in: many guests ask before they have an account). `hostMessage` in `src/modules/directory/schemas.ts` checks it
(name, email, the message, and optionally the stay and the number of guests; the dates come as a pair with check-out
after check-in, or not at all). The route allows five questions an hour per address, counted across all places, so
nobody can flood the hosts' inboxes. `sendHostMessage` (`directory/server/contact-host-service.ts`) refuses with 404
for a place that is unknown, paused or deleted, and with 403 when the host takes questions on WhatsApp only
(`HostProfile.contactBy`) and the place has a WhatsApp number; otherwise it queues `notify.host-message`. The choice
covers all the host's places while the number is each place's own (and optional), so `acceptsMessages` keeps
Contact host open on a place with no number: a guest always has one way to reach the host. Nothing is stored: there is no inbox in the
app to read, and a question nobody answers must not look answered.

`notify.host-message` (`directory/server/directory-notifications.ts`) writes to the people who can decide the
place's bookings (`listPeopleWhoDecideBookings`, the same readers as a new request), one email per language with the
**guest as the reply address**, so answering the email reaches the guest; then a push to each of their devices, after
the emails, so a retried email never pushes twice. The job carries the question itself (plain values: there is no
row to load) and reads the host's choice and the place's number again when it runs, so a host who switches to
WhatsApp only meanwhile is not written to. Each question has its own reference, so a retried delivery is never sent twice.

Tests: `src/modules/directory/tests/contact-host.integration.test.ts`.

### C. Contact the Mabeet team (F24)

The Contact page's form posts to `POST /api/public/contact` (no sign-in; `contactMessage` in
`src/modules/contact/schemas.ts`: name, email, a topic from `src/config/contact.ts`, the message). The route allows
five messages an hour per address (`enforceRateLimit`). `sendContactMessage` refuses with 503 while `CONTACT_EMAIL`
is unset, so a message is never accepted and then lost; otherwise it queues `notify.contact-message`, which emails
the team's inbox with the sender as Reply-To, the topic and the sender's language in the details, and a per-message
idempotency key. Nothing is stored. `CONTACT_WHATSAPP` (digits with the country code) adds a WhatsApp button
(`whatsappLink` in `src/utils/whatsapp.ts`). Tests: `src/modules/contact/tests/contact.integration.test.ts`.

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
- Emails only reach other people's inboxes after the sending domain is verified on Resend. The live site needs it:
  every new account confirms its email before it can sign in, so with Resend's test sender no one else could.

### Archiving a place

The owner archives their own place from Settings (`setPlaceArchived` in `workspaces/settings-service.ts`, route
`PUT /api/workspaces/{businessId}/archive`), or brings it back. Archived (`BusinessStatus` `ARCHIVED`), it is closed
to guests everywhere at once, because every public read and every new booking asks for `ACTIVE`: its page, search,
the guest MCP and the booking routes. Unlike a suspension, its team keeps the dashboard (`TEAM_OPEN_STATUSES`, read by
`findActiveMembership`), where a line above every page says it is archived. Bookings already made stay as they are.
Only the business's own owners decide, never a visiting platform admin; the status moves only from `ACTIVE` to
`ARCHIVED` and back, so an owner can never reopen a place the admin suspended (409). Logged as `business.archived` and
`business.restored`. Tests: `src/modules/workspaces/tests/archive-place.integration.test.ts`.

### E. Experiences and services

Hosts can sell seats in dated sessions (a hike, a wine tasting, an airport transfer).

- **Two modules.** `offerings` owns the catalogue and its schedule (`offering-service.ts`, `offering-repository.ts`):
  what is sold and when its sessions run. Who sits in a session is the booking engine's, so seat bookings live in
  `bookings` (`session-booking-service.ts`, `session-booking-repository.ts`), next to stays, and `bookings` calls
  `offerings` (never the other way). `offering-lookup.ts` is what `bookings` reads and changes there: the bookable
  offering by its link, an open session, the session lock (`lockSession`), taking a session off the schedule, and
  `priceSession` (the price for each guest, or once for the group).
- **The catalogue** (`offerings.manage`): `createOffering` counts against the plan
  (`assertPlanAllowsAnother(businessId, "offerings", tx)` in the same transaction; Free has one), gets a unique link
  from the title, and takes its region from the town when the host picks none. A category must be one of the admin's
  categories of the same type. `updateOffering` changes only the fields sent; `active: false` takes it off the site.
  Each change is logged (`offering.created`, `.updated`).
- **The schedule**: `scheduleSessions` makes one session on each date, all at the same local time where the business
  is (`zonedInstant` in `src/utils/zoned-time.ts`: 06:30 in Beirut is 04:30 UTC in winter, 03:30 in summer), each as
  long as the offering, and only in the future (`session.scheduled`). `cancelSession` (in `bookings`, because it reads
  the seats) locks the session, lets holds that ran out go, and refuses while anyone holds seats in it: their bookings
  are declined or cancelled first, so each guest is told and refunded (`session.cancelled`).
- **The same engine as a stay.** The seats are taken at once, in the business's mode (`initialStatus`): 10 minutes for
  the online payment, or the owner's answer time offline. A booking never waits past the moment its session starts
  (`sessionHoldUntil`). The owner confirms, declines or cancels with the same rules and the same refusals
  (`assertOwnerCanAnswer`, `assertTransition`), the guest cancels from the same private link and route as a stay
  (`cancelBookingAsGuest` tries the stay, then the seats), and housekeeping expires unpaid or unanswered seats
  (`expireAllStaleSessionHolds`). Every change locks the session first.
- **When it is too late.** Nobody answers a session that has started. A session's money is released to the host from
  its day on, as a stay's from its check-in day (`sumHeldMoney`), so from that day seats can no longer be cancelled
  and refunded (`sessionDayHasCome`).
- **No overselling.** The `session_seats_guard` trigger locks the session and refuses selling too many seats
  (23P01, shown as "Those seats were just taken"). If 20 guests race for the last 5 seats, exactly 5 get one.
- **Money.** Paid online in full, like a stay: a `Payment` row has a `bookingId` or a `sessionBookingId`
  (`PaidFor` in `payment-repository.ts`), and checkout, settling, refunds, the payouts page and the admin's refunds
  to send by hand read both. Declined, cancelled or expired paid seats are refunded in full.
- **Emails and push** are the stay's, with the words for seats: each notify job takes `kind: "session"`
  ("Your seats at … are held", the session's time instead of dates). The bell and the guest's Activity page read the
  same log entries, with `entity: "session_booking"`.
- **Routes:** `GET`/`POST /api/workspaces/{businessId}/offerings`, `PATCH .../offerings/{offeringId}`,
  `POST .../offerings/{offeringId}/sessions`, `DELETE .../sessions/{sessionId}`, `GET .../session-bookings`,
  `POST .../session-bookings/{bookingId}/{action}`, and for guests `POST /api/public/experiences/{slug}/bookings`
  (signed in, the stay requests' rate limit), then the stay's `/api/public/bookings/{token}/checkout` and `/cancel`.
- **What guests see** is put together in `directory` (`offering-page-service.ts`), which reads the offering from
  `offerings` (`findPublicOffering`, `listPublicOfferings`: active, at an active place, sessions not started) and
  the seats taken from `bookings` (`countTakenSeats`: confirmed seats, and held or unpaid ones whose time has not run
  out). `getOfferingPage` (cached per request as `loadOffering`) gives `/o/[slug]` each session with its seats left;
  `browseOfferings(kind, take)` gives the Experiences and Services tabs of the home and search pages, listed places
  only, the offerings with a date first. The private link `/b/[token]` reads the stay, then the seats
  (`getSessionBookingForGuest`), and `BookingView` shows either.
- **The host's screens:** `/dashboard/[businessId]/offerings` (`offerings.manage`) lists them in a `DataTable`, with
  `OfferingEditor` and `SessionScheduler` (the seats taken in each session, from `countTakenSeats`) in pop-ups. The
  Bookings page lists the seats under the stays, by the same tabs (`listSessionBookings` with `startsFrom` or
  `startsBefore`), with the same `BookingRow` and answers. Photos for an offering are not built yet: its card and
  page show the place's drawn art.

Tests: `src/modules/offerings/tests/offerings.integration.test.ts`,
`src/modules/bookings/tests/session-bookings.integration.test.ts` (the modes, the race for the last seats, payments
and refunds, guest cancel, expiry, cancelling a session, isolation, the team's list by tab), the seats case in
`booking-rollback.integration.test.ts`, the seat emails in `booking-notifications.integration.test.ts`, and
`sessionHoldUntil` and `sessionDayHasCome` in `booking-policy.test.ts`, and the guest's side in
`src/modules/directory/tests/offering-page.integration.test.ts` (seats left, a switched-off offering, the browse tabs,
the private link).

### F. Favourites (F5)

Signed-in guests can save places. Code: `favorite-service.ts` and `favorite-repository.ts` (directory), behind
`directory/server.ts`: `setFavorite(userId, slug, saved)`, `isPlaceSaved(userId, slug)` and `listMyFavorites(userId)`.
The reference project used a server action (`src/app/actions/favorites.ts`); ours is a route like every other write,
`PUT` and `DELETE /api/me/favorites/{slug}` (signed in, 120 changes a minute), so it is wrapped by `route()`, is in
the contract, and no server code is pulled into a browser file through the module's door.

- Saving is about a place, never about a stay: no dates and no prices are kept, and the saved list shows what each
  place costs a night today.
- Nothing is deleted. Unsaving marks the row (`isDeleted`) and saving again brings the same one back, so one guest
  never collects two rows for one place (`@@unique([userId, businessId])`).
- Saying the same thing twice is not an error. The heart on the page and the list in the account can be out of
  step, and the guest's last tap decides.
- `listMyFavorites` reads the saved ids, then builds the same `PlaceCard`s search builds (`buildCards` in
  `directory-service.ts`, shared by both so a card never means two things), newest first. A place its owner has
  **unlisted** stays on the list, because its page still works and the guest chose it; a **paused or deleted** one
  drops off, and so does one with no bookable unit left, because there is no price to show.
- An unknown or paused place cannot be saved at all (404).

Tests: `src/modules/directory/tests/favorites.integration.test.ts`.

### F. Featured partners and sponsored listings

Bonus (F23), built on "N. Near your stay".

- **Partner places** are places near guesthouses that are not on the platform: restaurants, supermarkets, parks,
  museums. Their kinds are a list in `src/config/partner-kinds.ts`. Platform admins add them at `/admin/partners`
  with a region, a map pin, a photo, a link and a phone. They are never booked through us.
- **Sponsored listings:** an admin can sponsor a partner place, or an experience or service of the platform, for a
  set of dates (`partner-service.ts`; only platform admins). While sponsored, it comes first in "Near your stay" and
  always shows a "Sponsored" label. A guest never sees a sponsored item without that label.
- Partners are soft-deleted like every business table (removed, then brought back with their sponsorships), and
  every admin change is logged in the same transaction (`partner.created`, `.updated`, `.removed`, `.restored`,
  `.sponsored`, `.sponsorship_ended`).
- Module `partners` (`partner-service.ts`, `partner-repository.ts`); routes `/api/admin/partners` (list, add),
  `/api/admin/partners/{partnerId}` (save every field, remove), `.../restore`, `.../sponsorships` (sponsor) and
  `.../sponsorships/{sponsorshipId}` (end). Anyone but a platform admin gets 404, as everywhere in the admin area.
- A partner's photo is a link (`https` only), never an upload: partners are not on the platform (`07`, section 5).
- Guests: `getPlace` (directory) adds `nearby`, and the guest's booking page reads the same through
  `listNearStay(slug)` (none once the place has closed; test `near-stay.integration.test.ts`), from
  `listNearbyPartners(place, now)`: the live partners of the
  place's region, sponsored ones first (marked `sponsored`, only on the days their sponsorship covers), then the
  nearest by map pin (`src/utils/geo.ts`), then by name, at most 12. A place with no region shows none.
- Screens (`src/modules/partners/components/`): `/admin/partners` shows `PartnerManager`: each live partner is a
  `DisclosurePanel` (its kind, or "Sponsored now", beside the name) holding `PartnerForm` (every field; the link can be
  a website or a social page), `PartnerSponsorships` (first and last day; the form sends the day after the last) and
  Remove; then "New partner"; then the removed ones with "Bring back". The
  place page shows `NearbyPartners` under "Things to do near your stay" (between the amenities and Meet your host, as
  the map is not built yet): cards in a `ScrollRail` with the photo (any https host, so not through the image
  resizer), the kind, "Sponsored", the town and distance, the link (named Instagram, Facebook or TikTok for those
  sites) and the phone. With no partners the section is not shown. The seed adds nine demo partners in the demo
  places' regions, three sponsored for 60 days. Test: `tests/e2e/partners.spec.ts`.
- Sponsoring an experience or service is built with experiences (F8): the table already takes it, and those
  offerings then join the same list.
- **Featured guesthouses:** `featurePlace(actor, { businessId, startsOn, endsOn })`, `endPlaceFeature(actor,
sponsorshipId)` and `listFeaturedPlacesForAdmin(actor)` (`partner-service.ts`; only platform admins, an open place
  only, days already over refused; logged as `place.featured` in the place's own log and `place.feature_ended`).
  Routes `/api/admin/featured-places` (list, feature) and `/api/admin/featured-places/{sponsorshipId}` (end).
  `searchPlaces` (directory) asks `listFeaturedPlaceIds(now)` and reads the featured places that match the search on
  their own (`PlaceFilters.ids`), so one is never left out of a page because others came first in the database; they
  come first, and each card carries `featured`, which `PlaceCard` shows as a "Featured" label on the photo. The home
  page and the guest MCP use the same search, so they agree. The admin features a place in the "Featured
  guesthouses" panel at the top of `/admin/partners` (`FeaturedPlaces`: the place, first and last day, and End on
  each). Test: `featured-places.integration.test.ts` (partners).

### H. Host profile (F7a)

The owner's own profile (name, bio, city, languages, years hosting, how guests may contact them). It shows on their
listings only if they choose. Code: `host-service.ts`.

It has **no phone or WhatsApp number**. The numbers guests use are always the **business's** (`Business.whatsapp`
and `phone`), the same on the place page and the booking page. The host's own number is `User.phone`, for the
platform admins.

**What guests see.** `getHostSection(businessId)` in `workspaces/server/host-service.ts` (behind
`workspaces/server.ts`) gives the host of a place's public pages: `contactBy`, and `profile` only when the host
turned `showOnListings` on. The host is the place's **first owner still on the team** (`host-repository.ts`, the
oldest active membership on the owner role), so the page does not change when another owner joins. A host who never
wrote a profile, or whose profile is deleted, is shown as no profile and reached both ways (`BOTH`, the schema's own
default): how guests may reach a host is a setting, not a personal detail, so it applies even while the profile is
hidden. The shown name is `displayName`, or the account name when it is empty.

**How the host answers.** `getResponseStats(businessId, since)` in `bookings` (`booking-stats.ts`, the raw query in
`booking-stats-repository.ts`) counts only the requests that really waited for the host: an automatic booking never
asks them, and a mode 2 booking whose payment never came never reached them. A request counts as **answered** when a
person confirmed or declined it, and as **missed** when it expired waiting; one cancelled meanwhile counts as
neither, because a later cancellation overwrites `decidedAt`. The clock starts when the request reached the host: at
once offline, at the payment in mode 2. `getPlace` turns it into `host.response` (the share answered, and the
typical minutes) over the past year (`RESPONSE_WINDOW_DAYS`), and gives nothing at all under three requests
(`MIN_REQUESTS_FOR_RESPONSE`), because one missed request would read as a 0% response rate. The pure rules for how
guests read these figures are in `src/modules/directory/host.ts` (`acceptsMessages`, `offersWhatsapp`,
`responseSpeed`, `yearsHosting`).

Tests: `src/modules/directory/tests/host-section.integration.test.ts` and `host.test.ts` (directory).

### L. Languages

- `messages/en.json`, `ar.json` and `ar-LB.json` hold every text on screen, in the same top-level groups as the
  reference project (`nav`, `footer`, `home`, `placePage`, `dashboard`, `serverErrors`...). Each group has one owner
  (`01-work-split.md`, "Who owns each group of the message files"): add texts only under your own groups. A new group
  goes in that table in the same pull request that adds it.
- English is the model. Its keys type `t("...")` (`src/global.d.ts`), so a wrong key fails the type check. A unit test
  (`tests/unit/messages.test.ts`) fails if a key is missing, extra or empty in any file, if a text is not valid for
  next-intl (a missing brace, an unclosed tag), if a key name has a dot, or if a translation needs other `{names}` or
  `<tags>` than the English text (plural and select forms are read properly).
- A text may hold `{name}`, plural forms and tags such as `<em>`. Read tags with `t.rich("key", { em: ... })`.
- The language is not in the address. The `locale` cookie decides, then the browser's `Accept-Language` (`pickLocale`
  in `src/config/appearance.ts`, the same rule the API and the emails use). `src/i18n/request.ts` loads the messages and
  `src/app/layout.tsx` sets `lang` and `dir` on `<html>`. Arabic pages are right-to-left.
- The visitor changes language with `AppearanceMenu`, which calls the `setLocale` server action
  (`src/app/actions/locale.ts`): it checks the value against `LOCALES`, saves the `locale` cookie for a year, saves it
  on a signed-in person's account (`setMyLocale`, so their emails follow it) and builds the pages again. The language names (`appearance.languageNames`) are each written in their own language.
- Numbers use the digits 0 to 9 and dates the Gregorian calendar in all three languages. Both Arabic languages write
  prices with a decimal point (`ar-LB`'s own format has a decimal comma, which reads as thousands next to dollar prices).
  Use `formatMoney` and `formatDate` from `src/utils/format.ts`, never `toLocaleString` by hand.
- Server error messages are translated by `localizeError`, using `serverErrors` (`messages`, `entities`, `statuses`).
  Every new message thrown with `conflict(...)`, `invalid(...)` and the like needs its text there, in all three files.
- In components use `useTranslations("namespace")`. On the server use `getTranslations`.

### M. Money: guests paying online

Code: `src/modules/bookings/server/booking-payments.ts`. Route: `POST /api/public/bookings/{token}/checkout`
(signed in, rate limited, `method` WHISH or CARD).

The buttons: `PayOnline` (`src/modules/payments/components/pay-online.tsx`, from `@/modules/payments`). The guest's
booking page renders `<PayOnline token={booking.publicToken} methods={onlinePaymentMethods(booking.currency)} />`
only while the booking waits for its payment (`AWAITING_PAYMENT`), under "Pay {amount}" and the countdown. One button
per open way to pay, Whish first; a press calls the route and goes to the payment page (`useRedirectAction`), with the
pressed button spinning and both disabled, so a double tap never starts two payments. With no way open it says to
message the host. Texts: `confirmation.pay`. Tests: `tests/unit/pay-online.test.tsx`.

1. `startBookingCheckout` creates a pending payment and returns the Whish or Stripe payment page. If the provider
   refuses, the payment is marked failed and the booking keeps waiting. Whish takes USD and LBP; cards take USD and
   EUR (`onlinePaymentMethods(currency)` says which are open).
2. When Whish calls us back, Stripe's webhook arrives, or the guest comes back (`refreshGuestPayments`, for the
   booking page), we only run `settleOnlinePayment`. Once paid, the booking moves on by its mode: `CONFIRMED` in
   mode 1 (the hosts are told), `HELD` in mode 2 with the owner's answer time (the owner gets the request).
3. `settleOnlinePayment` asks Whish or Stripe what really happened. Their answer decides. So a fake callback cannot
   confirm a booking.
4. Marking a payment as paid happens only once, in a transaction. Calling it many times changes nothing.
5. If a payment arrives after the booking ended, it is refunded in full automatically.
6. A scheduled job checks payments still pending after 2 minutes.

### M. Money: refunds

Code: `src/modules/bookings/server/booking-payments.ts` (`refundPayments`, `sendRefunds`, `retryPendingRefunds`).

- Whoever ends a paid booking (guest, owner, or the clock), and a payment that lands after the booking ended or on
  one already paid: full refund, automatically.
- **A stay that has started can no longer be cancelled, by the owner or the guest.** Payouts only release money
  for confirmed stays that have started, so a refund can never give back money already paid out to the owner. The
  payout service must keep to this: available money is confirmed, started, unrefunded stays only.
- The refund row is written in the same transaction that ends the booking (`PENDING`, the payment marked
  `REFUNDED`); Whish or Stripe is called after the commit, and the row becomes `DONE` when they confirm it.
- Card refunds go through Stripe, with the refund's id as Stripe's idempotency key; Whish refunds go through Whish,
  which refunds a payment once. So sending again never pays twice.
- A refund the provider refuses stays `PENDING`: housekeeping sends it again for a day, then it waits on the admin
  page to send by hand.

### M. Money: payouts to hosts

- Online money is held for the host.
- The owner sees how much is available and asks for a payout to a Whish number or a bank account (IBAN). Never card
  numbers.
- An admin sends it by hand from the platform's Whish or Stripe account, and marks it sent with the transfer
  reference.
- The business row is locked, so two requests cannot spend the same money.
- **Available** is worked out every time, never stored: online payments for confirmed stays that have started, net of
  refunds, minus payouts sent or still asked for. Everything else paid online is "upcoming". A refused request is
  available again.
- **Who does what.** The payments are the booking engine's, so `src/modules/bookings/server/host-money-service.ts`
  works out the balance and saves the request under `lockBusinessMoney`; `payments` keeps the `Payout` rows
  (`payout-service.ts`) and the admin's decision. Routes: `GET/POST /api/workspaces/{id}/payouts` (owners only),
  `POST /api/admin/payouts/{payoutId}` (`paid` with the transfer's reference, or `rejected` with a note) and
  `POST /api/admin/refunds/{refundId}` (a refund a provider kept refusing, sent by hand), both platform admins only.
- **Platform admins** reach `/api/admin/**` through `adminRoute(paramsSchema, handler)` (`src/server/http/route.ts`),
  which reads the person's role from the database and answers 404 to anyone else. Services take a `PlatformActor`
  and call `requirePlatformAdmin`; what they do is logged with `recordPlatformAction`, under the admin's name.
- **Only the business's own owners** ask for its payouts and write its host profile (`requireBusinessOwner`,
  `isBusinessOwner` in `tenant-context.ts`). A platform admin visiting a business has an owner's rights to help, but
  is not its owner: those menu lines and pages are hidden from them, and the admin sends payouts from `/admin/money`.
- **The screen** is `/dashboard/{id}/payouts`: the balances per currency, `PayoutRequestForm` (from `payments`, filled
  with the details used last time) and the payouts and online payments. Its menu line is `ownerOnly` in
  `src/components/dashboard/nav-items.ts`, so a member whose role holds every permission still never sees it, and the
  page answers 404 to anyone but the business's own owners.

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
- **All or nothing with R2:** R2 is never called inside the transaction. The file goes up first, then its
  `StoredImage` and `Photo` rows are saved in one transaction; if that fails, the file is removed from R2 again
  (`deleteObject`), so nothing is left behind.

The galleries are the place's own (no room) and each room's; both need `rooms.manage`, and a gallery holds 20 photos.
Routes: `POST /api/workspaces/{businessId}/photos` (multipart through `parseUpload`: `file`, and optional `roomId`,
`alt`, `area`; 60 uploads an hour per member), `PATCH .../photos/{photoId}` (`{ cover: true }` puts it first,
`{ area, alt }` tags it for the photo tour), `DELETE .../photos/{photoId}`, and the public `GET /api/images/{id}`.
Code: `photo-service.ts`, `photo-repository.ts` (in `rooms`), the R2 client and the resizing in `src/server/storage/`.
Tests: `photos.integration.test.ts` (rooms), with R2 faked and a failed save that must take the upload back down.

### P. Places and rooms (public)

`directory-service.ts` is the public side:

- `searchPlaces(search, now)`: filters and dates (see "Search" below).
- `getPlace`, `checkAvailability`, `quoteRoom`, `getTakenNights`.

Availability itself lives in `bookings` (it owns the night rows), behind `bookings/server.ts`
(`availability-service.ts`), and the directory calls it:

- `getTakenNights(businessId, roomId, range, now)`: the ISO nights in `range` (check-out night not included) that a
  guest cannot book: confirmed stays, live holds, imported platform stays and closed dates. Holds whose time ran out
  count as free already, as they do for `requestBooking`. At a place with a whole-place unit, a room's nights include
  the whole place's, and the whole place's include every room's. Dates only, never who or why; no sign-in.
- `findFreeRooms(roomIds, range, now)`: for search, the rooms free on every night of `range`, with the same rules, in
  two queries however many rooms (the rooms' kinds through `rooms/server.ts`, then the taken nights). Unknown,
  closed or deleted rooms are never free. Both refuse an empty or backwards range and more than 366 nights;
  `findFreeRooms` takes 500 rooms at most. Tests: `availability.integration.test.ts`.

The website search, the guest's AI and the guest MCP all use it, so they always agree.

**Search.** `searchPlaces(search, now)` in `directory-service.ts` gives a `PlaceCard` per listed place that has a unit
fitting the search, in at most a few queries however many places: `listListedPlaces` (workspaces: listed, live,
not deleted, by town or region, words, categories, tags and accessibility), then `findSearchUnits` and
`findPlaceCovers` (rooms: each place's units of the kind it books by, by guests, base price, amenities, bedrooms,
bathrooms and beds), then, with dates, `findFreeRooms` (bookings) and `priceStays` (rooms, one query for every
room's special prices). With dates a unit counts only when `stayIssue` has nothing against the stay and it is free
on every night, so search never shows what booking would refuse. A region ("North Lebanon", "الشمال") matches the
region a place stores or any of its towns (`areasMatching` in `src/config/regions.ts`). Nothing is returned rather
than a near miss. The address holds the search (`searchParams` in `directory/schemas.ts`: wrong values are dropped,
dates are kept only as a stay a guest could book) and `toPlaceSearch` turns it into the service's input, prices into
minor units. Tests: `place-search.integration.test.ts` and `schemas.test.ts` (directory).

**What exists today:** `quoteRoom(slug, roomId, { range, guests }, now?)` in `src/modules/directory/server/directory-service.ts`,
behind `GET /api/public/places/{slug}/rooms/{roomId}/quote` (no sign-in, 120 a minute from one address). It gives each
night's price, the total (always the full amount), and `issue`: why the stay cannot be booked as asked, as a code the
screen translates (`PAST`, `TOO_FAR`, `TOO_LONG`, `MIN_NIGHTS`, `CAPACITY`; the list is in
`src/config/booking-limits.ts`). A stay with an issue still gets its price, except one longer than the longest stay,
which is not priced. The rule is the booking engine's own: `stayIssue` in `bookings/server/booking-policy.ts`
(exported from `bookings/server.ts`), pure and tested in `stay-issue.test.ts`. The engine refuses a booking with the
same function (`assertBookableStay`, which turns the code into the guest's sentence), so the quote and the booking can
never disagree. The two limits (60 nights, 540 days ahead) are `MAX_STAY_NIGHTS` and `MAX_DAYS_AHEAD` in the same
config file, and nothing else keeps a copy. A room the host switched off, or one the place does not book by (a room of a place that books whole), is "Room not found", as booking it would be.
It reads the place, the room and the price through `workspaces`, `rooms` and their `server.ts` doors, so it needs no
database code of its own. The availability reads exist in `bookings` (`getTakenNights`, `findFreeRooms`, above).

The public page reads, for `getPlace` (all without sign-in, each through its module's `server.ts`):

- `getPublicPlace(slug)` in `workspaces`: the place's public fields (name, description, area and region, address
  and map pin, the business's own `phone` and `whatsapp`, currency, answer time, check-in and check-out times, house
  rules, booking unit and mode, tags, accessibility, minimum guest age). Never its plan, Stripe ids, commission rate
  or payment instructions (a guest sees those on their own booking). Null when the place is unknown, paused or
  deleted. An unlisted place keeps its page, because its link is shared on Instagram; only search leaves it out.
- `listPublicUnits(businessId, kind)` in `rooms`: the live, non-deleted units of one kind (pass
  `BOOKABLE_ROOM_KIND[place.bookingUnit]`, so a unit that cannot be booked is never shown), with their non-deleted
  photos in the host's order. Never the room's `exportToken`, its private calendar link.
- `listPlacePhotos(businessId)` in `rooms`: the place's own photos (not a room's or an experience's), in order, for
  the gallery and the photo tour.
- `getHostSection(businessId)` in `workspaces` and `getResponseStats` in `bookings`: the host as guests meet them
  (see "H. Host profile"), which `getPlace` gives as `host`, next to the place's own `whatsapp` number.

Tests: `public-place.integration.test.ts` (workspaces) and `public-units.integration.test.ts` (rooms).
`getPlace(slug)` (directory) puts them together as a `PublicPlace`: the place's public fields, its bookable `units` (the
rooms, or the one whole-place unit) with their photos, its `rooms` to show (at a place booked whole, the rooms inside it),
and its photos (the rooms' photos when it has none of its own). `getRoomAvailability(slug, roomId, range)` is the calendar's
read, behind `GET /api/public/places/{slug}/rooms/{roomId}/availability` (no sign-in, 120 a minute from one address): the
taken nights as dates, for the year ahead by default (`AVAILABILITY_DAYS`), for the same rooms a quote accepts.
The guest's booking route is `POST /api/public/places/{slug}/bookings` (`requireVerifiedUser`, 10 requests per 10 minutes per guest): it
calls `requestBooking` with the guest taken from the session, and answers `{ publicToken, reference, status }` only. The
book page (`/p/{slug}/book`) is its screen.
The guest's own booking page is `/b/{token}`: `getBookingForGuest` (someone else's link is "not found"), then
`refreshGuestPayments` first when the booking waits for its payment, so a guest back from the payment page sees it at
once. `POST /api/public/bookings/{token}/cancel` (`requireUser`, 10 requests per 10 minutes) calls `cancelStayAsGuest`
with a reason that is optional; the engine refuses once the stay has started (409) and refunds online payments in full.
The guest's trips are `listMyTrips(guestUserId)` (directory, over `listMyBookings`): a `GuestTrip` per stay with only what the
list needs (no payments, no guest contact, no hold time). The page `/account` and `GET /api/me/bookings` both read it;
`splitTrips` divides it into upcoming and past. The place page's parts and the
booking box are built too (see `08`, "Built so far").

### P. Pricing

`quoteStay` in `pricing.ts`:

- each night's price (the room's base price, or that night's special price),
- the total (always what is paid online; there are no deposits).

Money is always whole cents, stored as `BigInt` and handled as a number (see "Rules for the schema").

### P. Push notifications and installing the app

The site can be installed on a phone. It has a manifest (`src/app/manifest.ts`: full screen from `/`, the icons of
the site's palette from `public/brand/icons/{palette}/`), icons and a service worker (`public/sw.js`) that shows
notifications. We only accept push subscriptions from real browser push services. A device always belongs to a
signed-in person (booking needs an account), and one browser endpoint is one row (`endpoint` is unique): subscribing
again replaces its keys, and someone else subscribing on the same browser takes it over. Pages are never served from the
cache, because availability must always be live.

**What exists today:** `src/server/push/` sends (`sendPush`, signed with `VAPID_*`; without both keys push is off) and
checks addresses (`isPushServiceUrl`: only Google, Mozilla, Apple and Windows push services, over https). The
`notifications` module keeps the devices: `POST /api/me/push` (the browser's `PushSubscription.toJSON()`, signed in,
20 changes an hour) and `DELETE /api/me/push` (`{ endpoint }`, only the person's own device). `pushToPeople(userIds,
messageFor)` reaches every device of those people whose account is open, each in its owner's words; a device its
push service calls gone (404, 410) is deleted; it never throws. The notify jobs push after their email has gone
(`tellHosts` and `tellGuest` in `booking-notifications.ts`, and "they joined your team" in
`team-notifications.ts`), using `noticeAsPush(message)`: the email's title, first line and button link. So a retried
email never pushes twice, and a push failure never sends an email again. A guest with no email address still gets the
push. `public/sw.js` shows the notification and opens its page (only pages of this site). The switch on screen
(`PhoneAlerts`) comes with the account's notifications tab. Tests: `push.test.ts` and
`push-devices.integration.test.ts` (notifications).

### R. Reviews (F5)

Only a guest who stayed may review, only once, and only after check-out. A review is one overall rating (1 to 5) and
a comment; there are no sub-ratings (cleanliness, location, value). Owners can reply or hide a review with a reason.
A review whose author closed their account stays, without their name: closing an account keeps the user row (marked
deleted), so review reads show no name when `author.isDeleted` (F17). Code: `review-service.ts`.

**What exists today** (the `reviews` module: `review-service.ts`, `review-repository.ts`, behind
`reviews/server.ts`):

- `writeReview(guestUserId, publicToken, input, now?)`: the booking is found through `bookings`' own door
  (`getBookingForGuest`), so someone else's stay is "not found", like its page. It must be `CONFIRMED` (a stay that
  was declined, expired or cancelled never happened) and its check-out must be past (403 with the reason). The
  second review of one stay is refused by the database itself — `Review.bookingId` is unique, wrapped in
  `duplicateAsConflict` — so two taps cannot leave two reviews. Route: `POST /api/public/bookings/{token}/review`
  (signed in, 10 per 10 minutes per guest), input `newReview` (rating 1 to 5, comment 10 to 2000 characters).
- `listPlaceReviews(businessId)` and `getPlaceRating(businessId)`: only `PUBLISHED`, not deleted, newest first; the
  average is to one decimal (`averageRating` in `reviews/rating.ts`, pure) and is null until someone has rated, so
  a new place says "No reviews yet" instead of showing a 0. A hidden review counts for nothing, not even the
  average.
- `findReviewedBookings(bookingIds)`: which stays their guest has already reviewed. `listMyTrips` (directory) uses
  it for `canReview`, so a stay is offered the form only while it is over, went ahead, and has no review.
- `getPlace` carries `rating` and `reviews`, so the place page needs no second read.

- `listTeamReviews(ctx)`, `replyToReview(ctx, reviewId, { reply })` and `setReviewVisibility(ctx, reviewId,
{ hidden, reason })`, all behind `reviews.reply`: the team sees every review, hidden ones included, with the room
  and booking reference of the stay. A reply shows under the review on the place's page; an empty one takes it
  away. Hiding needs a reason (3 to 500 characters), keeps the review, and takes it out of the page and the rating;
  showing it again clears the reason. Each change is logged (`review.replied`, `review.reply_removed`,
  `review.hidden`, `review.shown`). Routes: `GET /api/workspaces/{id}/reviews`, `PUT .../reviews/{reviewId}/reply`
  and `PUT .../reviews/{reviewId}/visibility`. Screen: the dashboard's Reviews page (`TeamReviewList`,
  `ReviewControls`).

Tests: `src/modules/reviews/tests/reviews.integration.test.ts`, `team-reviews.integration.test.ts` and
`rating.test.ts`.

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
listed. Needs `settings.manage`. Code: `settings-service.ts` (in `workspaces`), `settings-form.tsx`.

`GET` and `PATCH /api/workspaces/{businessId}/settings` (`settingsInput`): only the fields sent change, and an emptied
text box is saved as nothing. How money flows is the owner's alone, so changing `bookingMode`, or sending
`acceptOnlineTerms`, also needs the owner. An online mode (`AUTOMATIC`, `ONLINE_APPROVAL`) is refused until the
owner has accepted "online payments are always refunded in full" once (`acceptOnlineTerms: true` saves
`onlineTermsAcceptedAt`); bookings already made keep their own mode. The region is the host's pick, or the one the
town they typed is in (`regionOfArea`, `src/config/regions.ts`); a new place gets it from its town when it is created (`createWorkspace`). Tags and accessibility come from
`src/config/listing.ts`, currencies from `CURRENCIES` in `enums.ts`. `categories` are slugs of the admin's place
categories (`listCategories("HOME")` from `admin/server`), checked first and saved as the place's exact set: the
others are marked deleted and a category picked again is brought back, never added twice. Tests:
`settings.integration.test.ts` (workspaces).

Booking room by room or as a whole is its own route, `PUT /api/workspaces/{businessId}/booking-unit`
(`chooseBookingUnit` in `rooms`, for the place screen), because it needs the whole-place unit, and settings calling
`rooms` would close a circle between modules. It needs `settings.manage` and `rooms.manage`. In one transaction it
saves the choice (`saveBookingUnit` from `workspaces`) and, for a whole place, makes sure the one whole-place unit
exists: a new one starts from the live rooms added up (guests, bedrooms, beds, bathrooms, nightly prices) and is then
adjusted like any room; one taken off or deleted is brought back, never doubled. The rooms stay, and are bookable
again when the place goes back to rooms; bookings already made keep their own unit. The whole-place unit never uses
up the plan's rooms. Tests: `booking-unit.integration.test.ts` (rooms).

### T. Team and roles

Add a member by email with a role, change their role, or remove them. Create, change and delete roles. Only an owner
can make or change an owner. Nobody can change their own access. Code: `team-service.ts`.

Managing the team (`team.manage`) and managing the roles (`roles.manage`) are two permissions. The list of roles is
readable with either one, because inviting someone or changing a member's role picks one of them. The Team page
(`/dashboard/[id]/team`) shows each part only to a member holding its own permission, and offers only what the service
allows: `team-access.ts` (in the module's `index.ts`) reads the same rules, so a screen never offers a role the person
cannot give, a change to their own access, or an owner's row to someone who is not an owner.

---

## Part 8. How to build screens

### Server components first

- Pages are server components. They read data through services, using `requirePageTenant` or `requirePageAccess`
  (from `src/server/http/session.ts`). These show the 404 page to non-members.
- Pages pass plain data to client components.
- Add `"use client"` only when a component needs state, effects or click handlers.

### Calling the API from the browser

- Use `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`, `api.upload` from `src/lib/api-client.ts`. `api.get`
  takes the query as a second argument (`api.get(url, { page: 2 })`; empty values are left out). Never call `fetch`
  directly.
- If a call fails, it throws `ApiError` with `status`, `code`, `message`, `details`, and `retryAfterSeconds` on a 429.
  Three failures are ours, with status 0: `NETWORK` (no connection), `TIMEOUT` (no answer within the limit) and
  `ABORTED` (we cancelled it: `isAborted(caught)`; nothing went wrong, so show nothing).
- Every call has a time limit (30 seconds, 2 minutes for `api.upload`), so a connection that goes quiet ends in an error
  and not a spinner for ever. Every method takes an optional last argument `{ signal, timeoutMs }`: pass an
  `AbortSignal` to cancel a read that is no longer wanted. A call that times out may still have reached the server, so
  a screen must not "retry" a payment or a booking on its own: the server decides what a repeated request does.
- Show a failure with `errorMessage(caught, fallback)` and `FormError`. It returns the server's own sentence when a
  person can act on it ("Those dates were just taken"), and the translated `fallback` for a crash (`INTERNAL`), a lost
  connection, a timeout or an answer that is not ours. Until `localizeError` exists, a server sentence is in English.
- For a form, `formFailure(caught, fallback, shownFields)` also gives `fieldErrors`: the first problem of each wrong
  field the form shows, by field name. Show the text you want under each field, in the visitor's language. A wrong
  field the form does not show (a value the screen sends on its own) gives the whole form the `fallback`, so a refusal
  is never silent.
- `api.run` (slow AI answers) is built with the AI features.

### Shared hooks

- `useAction(shownFields?)` (`src/hooks/use-action.ts`): `const { run, pending, error, fieldErrors } =
useAction(["name", "phone"])`. `run(() => api.post(...))` calls the API, then refreshes the page, and resolves to
  `true` when it worked. `pending` covers both steps. A form that shows a message under its fields names them; a
  button or a form without field messages passes nothing. After a failure, `fieldErrors` holds the named fields the
  server refused, and `error` (for `FormError`) is set for everything else, so every refusal shows something. A
  second `run` while one is going is ignored (a double click can never save, book or pay twice) and resolves to
  `false`.
- `useLiveQuery<T>(url, query, { delayMs, timeoutMs })` (`src/hooks/use-live-query.ts`): reads from the API and keeps
  the answer in step with what the screen asks as the visitor changes it: the dates, the guests, a search text.
  `const quote = useLiveQuery<Quote>(ready ? url : null, { checkIn, checkOut })` gives `{ data, error, loading,
reload }`. Changes in quick succession give one call (300 ms by default); a call that is no longer wanted is
  cancelled, and so is one that is still running when the page is left; `data` is `null` while the answer to the
  current question is on its way, so it is never the answer to an older one (a price for other nights); a `url` of `null`
  means "do not ask yet". Use it for every read that depends on what the visitor picks. For a read that does not
  change, read on the server.
- `useDebouncedValue(value, delayMs)`: a value that follows another only once it has stopped changing: show what is
  typed, search with the debounced value.
- `useRedirectAction()`: `const { run, pending, error } = useRedirectAction()`, for steps that end on another page
  (Stripe, Whish, an AI app's sign-in). `run(() => api.post(...))` expects `{ url }` and follows it only if it is a page
  of this site or an https address (`isSafeRedirect`).
- `useStoredChoice(key, allowed, fallback)`: `const [view, setView] = useStoredChoice("calendar-view", ["month", "week"]
as const, "month")`. Remembers a choice in this browser; a saved value that is no longer allowed is ignored.
- `useConfirm()` (`src/components/ui/confirm-dialog.tsx`): the "are you sure?" step before anything that cannot be
  undone. `const { confirm, dialog } = useConfirm()`, render `{dialog}`, then `const answer = await confirm({ title,
body, confirmLabel, tone, reason })`. `answer` is `null` when the person went back (Esc, the dark layer or "Go back"),
  and `{ reason }` when they went ahead. The texts come from the `confirm` group: `confirm.<action>.title`, `.body`,
  `.confirm`. `tone` is `danger` by default; the focus starts on "Go back".

### Loading, empty and error states

- Every dashboard page has a `loading.tsx`, built from `components/shell/skeletons.tsx` (`PageHeaderSkeleton`,
  `PanelSkeleton`, `CardGridSkeleton`; add one there when a new kind of page part needs it) and `Skeleton`, in the shape
  of the real page, with `<LoadingStatus />` for screen readers.
- A dialog is `SheetDialog` (a full-screen sheet on phones, a centred box from 640 px; `compact` for a short question),
  or `ShowAllDialog` for "Show all photos / reviews / amenities". Put `data-autofocus` on the element that should
  have the focus first.
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
| Calendar sync | every 5 min     | `POST /api/cron/sync-feeds`   | Reads up to 60 calendar links not read in 10 minutes, 6 at a time                                     | Calendars still update on "Sync now" and before each confirmation                             |
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
- No secrets in the repository. Live secrets are in GitHub's `production` environment; each deploy writes them to
  the server's `.env` (`docs/deployment.md`).

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
// business holds only what a guest may see (name, address, contact numbers, times, house rules, how to pay).

getBooking(ctx: TenantContext, bookingId: string): Promise<Booking & { room }>   // bookings.read
listBookings(ctx: TenantContext, filters: { status?, roomId?, from?: Date, to?: Date, take, skip }): Promise<Booking[]>
// Staff without guests.contact see the guest's phone and email masked.
listMyBookings(guestUserId: string): Promise<Booking[]>   // the guest's trips, newest first

getCalendar(ctx: TenantContext, query: { from?: Date; to?: Date; roomId?: string }, now?: Date)   // calendar.read
getCalendarBoard(ctx: TenantContext, query: { from?: Date; to?: Date; roomId?: string }, now?: Date)   // calendar.read: { rooms, occupancy }
addBlock(ctx: TenantContext, input: { roomId: string; range: DateRange; note: string | null }, now?: Date)   // blocks.manage
removeBlock(ctx: TenantContext, blockId: string, now?: Date)   // blocks.manage
reopenNights(ctx: TenantContext, roomId: string, range: DateRange, now?: Date)   // blocks.manage: { reopened, leftClosed }, trims or splits blocks
// Closing taken nights gives 409 "Those nights are already booked or closed."

// The input checks for these routes are in `@/modules/bookings` (bookingRequestInput, decisionInput,
// bookingActionParams, bookingFilters, guestCancelInput, bookingTokenParams, blockInput, blockParams, calendarQuery,
// placeParams). Each hands the service its own shape (a DateRange, Dates, null for missing text).

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
