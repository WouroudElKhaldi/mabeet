# Architecture

How Mabeet is put together, and why. What it does is in the
[functional requirements](functional-requirements.md). Where each guarantee is tested is in the
[requirements matrix](requirements-matrix.md).

## Overview

One Next.js 16 app in TypeScript. PostgreSQL through Prisma. Better Auth for sign-in. Zod for every input.

Next.js serves the pages, the JSON API, the iCal feeds and the MCP endpoints from one codebase and one deploy.
Slow and retryable work (AI answers and reports, emails and push, scheduled housekeeping) runs in a **worker**
process from the same codebase, fed by queues kept in the same Postgres (pg-boss). See
[Queues and workers](#queues-and-workers).
Prisma gives typed queries and versioned migrations. Postgres does what Prisma can't: an `EXCLUDE`
constraint and triggers, written as hand-made SQL migrations.

Five ways in, one set of services:

```
 website pages ─┐
 JSON API ──────┤
 AI chat ───────┼──▶ services ──▶ repositories ──▶ PostgreSQL
 owner MCP ─────┤    (rules)      (queries)        (last word on
 guest MCP ─────┤                                   overlaps & seats)
 worker ────────┘                                  + pgboss schema (queues)
```

## Modules and layers

The app is a modular monolith: one Next.js app and one database, split into feature modules in
`src/modules/<name>/` (bookings, rooms, team, payments…). Each module holds its own layers below, and other
code reaches it only through its two doors: `index.ts` (input checks, types, screens) and `server.ts` (its
services). The shared kernel in `src/server/` (database client, auth and tenancy, route wrappers, jobs, email)
never depends on a module. What must be one transaction stays in one module: availability, holds and closed
dates all live in `bookings`, so no double booking is decided in one place. The full map is in
`docs/team/05-project-structure.md`.

| Layer            | Lives in                                       | Does                                                                                             | Never does                   |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| **Routes/pages** | `src/app/**`                                   | Read the request, validate it with a Zod schema, find out who is calling, call a service, answer | Business rules, Prisma calls |
| **Services**     | `src/modules/*/server/*-service.ts`            | Permissions, business rules, transactions, notifications                                         | Build HTTP responses         |
| **Repositories** | `src/modules/*/server/*-repository.ts`         | Prisma queries, always scoped by `businessId`                                                    | Decide anything, check roles |
| **Database**     | `prisma/schema.prisma`, `prisma/migrations/**` | Final guarantees: no overlapping nights, no oversold seats, sane values                          | Trust that the code is right |

The linter enforces the arrows (`eslint.config.mjs`): only repositories may import Prisma at runtime, nothing
in `src/app` may import a repository or the database client, nobody imports a module's inner files, and the
kernel never imports a module. A route that skips a layer fails `pnpm lint` and CI.

Every API route goes through one wrapper (`src/server/http/route.ts`). It parses input with the route's Zod
schema (from its module's `schemas.ts`; shared pieces in `src/lib/schemas.ts`), turns domain errors into HTTP codes, refuses cross-site writes, and
never leaks internal errors. Bad input gets `400` with the failing field. Routes that take no input (cron jobs,
`/api/me/bookings`, `/api/me/export`) have no schema. The Better Auth, MCP and Stripe endpoints hand their input
to code that checks it: Better Auth, each MCP tool's own Zod schema, and Stripe's signature check.

**Conventions that keep the layers clean:**

- **One definition per value list.** Statuses, payment methods, plans, report topics and analytics scopes live
  in `src/config/` (`enums.ts`, `plans.ts`). The Zod schemas, the services, the AI tools and the screens all
  import them, and `satisfies` checks each list against the Prisma enum, so a new status can't be missed.
- **Services hand repositories their database handle.** A service passes `prisma` or a transaction (`Tx`, from
  `src/server/db/client.ts`) to each repository call, so one transaction can span several repositories. Only
  repositories run queries.
- **Raw SQL is always Prisma's tagged `$queryRaw` template.** Values are bound parameters; shared
  fragments are `Prisma.sql`. There is no string-built SQL.
- **Database refusals become clear errors in one place.** `src/server/db/constraint-errors.ts` turns an
  overlap (`23P01`) or a duplicate (`P2002`) into a `409` with a message people can act on.
- **Side work runs after the response.** Small side writes (AI tool audit logs, AI usage records, "last used"
  times) go in `inBackground` (`src/server/background.ts`), run after the answer is sent. Emails and push are jobs
  on the `notify` queue, sent after the commit (see [Queues and workers](#queues-and-workers)). Neither ever slows
  down or breaks a request.

## Authentication, authorization and tenant isolation

These are three separate questions, answered in this order:

1. **Who are you?** (authentication) A Better Auth session cookie for the website. For AI apps, either a
   personal API key (only its SHA-256 hash is stored) or an OAuth access token. Cron jobs present `CRON_SECRET`.
2. **Which business are you acting in?** (tenant isolation) Your `Membership` in that business. A workspace URL
   names a business (`/api/workspaces/{businessId}/…`), but that id only picks between businesses you belong to.
   `tenantRoute()` looks up your active membership before the handler runs. No membership means `404`, never
   `403`, so nobody learns that a business exists. An API key or OAuth token starts in the membership it was made
   in. An AI can switch to another of the same person's places by naming it (`resolvePlaceContext`): only places
   they are an active member of, with their own role there, and a read-only key stays read-only. A name that fits
   several places is refused, never guessed. A platform admin can open any business's dashboard on the website
   (never through AI keys); their actions are logged under their own user id.
3. **What may you do there?** (authorization) The membership's role gives a set of permissions. The result is a
   `TenantContext` (`src/server/auth/tenant-context.ts`): user, business, permissions and channel. Every service
   function takes it and calls `requirePermission(ctx, "bookings.decide")` (or similar) itself.

```
caller ──▶ session / API key / OAuth token
             │
             ▼
        Membership (user + business + role)  ── none? ──▶ 404
             │
             ▼
        TenantContext { businessId, permissions }
             │
             ▼
        service: requirePermission(...)      ── missing? ──▶ 403
             │
             ▼
        repository: WHERE "businessId" = ctx.businessId
```

Repositories take `businessId` from the context in every query. A record id from another business finds nothing
and answers `404 Not found`, even inside your own workspace URL. Tests check this over HTTP and MCP
(`tests/integration/tenant-isolation.test.ts`, `mcp-isolation.test.ts`).

Roles are made by owners from a fixed list of permissions (`src/config/permissions.ts`). Nobody can grant a
permission they don't hold, and read-only AI keys keep only the reading permissions of their member (`rooms.read`,
`calendar.read`, `bookings.read`, `guests.contact`, `analytics.read`, `ai.use`).

**Guests** need no membership. Place pages are public by slug, but booking needs an account. A booking's private
link (`publicToken`, 32 random bytes) opens only for the signed-in guest who made it; they also see it in their
account.

## Booking vs Occupancy

This split is the core of the design.

- **`Booking`** is the guest's request and its lifecycle: who, how many, the price (an online payment is always the
  full `totalCents`), the business's `bookingMode` copied onto it, and a status
  (`src/modules/bookings/server/booking-status.ts`):

```
automatic:            AWAITING_PAYMENT ──paid within 10 min──▶ CONFIRMED
online with approval: AWAITING_PAYMENT ──paid within 10 min──▶ HELD ──owner confirms──▶ CONFIRMED
                                                                    ──owner declines──▶ DECLINED (full refund)
offline:              HELD ──owner confirms──▶ CONFIRMED            (paid between the owner and the guest)
                           ──owner declines──▶ DECLINED
EXPIRED: not paid within 10 minutes, or the owner did not answer within holdHours (full refund if paid)
CANCELLED: by the guest or the host, from any active status (full refund if paid online)
```

- **`Occupancy`** is inventory: "this room is taken on these nights". One row per taken range, whatever the
  cause:

| `kind`     | Comes from                                                              | `active` while                          |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `DIRECT`   | A Mabeet booking (one row per booking)                                  | `HELD`, `AWAITING_PAYMENT`, `CONFIRMED` |
| `MANUAL`   | A host closing nights: maintenance, a booking taken by phone            | until the host removes it               |
| `IMPORTED` | An event read from an Airbnb or Booking.com calendar link (or any iCal) | until it leaves the platform feed       |

Availability, the calendar, the iCal export and the overlap rule all read `Occupancy`, never `Booking`. A new
source of taken nights is a new `kind`, not a new set of checks.

## No double bookings

The guarantee: **two active `DIRECT` or `MANUAL` occupancies never share a room night.** The database enforces
it:

```sql
ALTER TABLE "Occupancy" ADD CONSTRAINT occupancy_no_overlap
  EXCLUDE USING gist ("roomId" WITH =, daterange("checkIn", "checkOut", '[)') WITH &&)
  WHERE (active AND kind <> 'IMPORTED');
```

`'[)'` counts nights: a guest leaving on the 12th never clashes with one arriving on the 12th.

**Why a check in code is not enough.** Code like this has a race:

```ts
if (!(await isTaken(room, dates))) await createBooking(room, dates); // two requests can both pass the check
```

Two requests can run the check at the same moment, both see a free room, and both insert. Only the database
sees every write, so it has the final say.

**What happens on a request** (`requestBooking` in `src/modules/bookings/server/booking-service.ts`):

```
POST /api/public/places/{slug}/bookings
  │  Zod: dates, guests, name, phone…        bad input ──▶ 400
  │  dates sane? (future, ≤ 60 nights)        no ──▶ 400
  │  place active? (by slug)                  no ──▶ 404
  ▼
BEGIN
  SELECT … FROM "Room" … FOR UPDATE           requests for this room queue here
  room fits? (guests, minimum nights)         no ──▶ 400
  expire this room's stale holds              frees nights nobody answered for
  any IMPORTED night in the range?            yes ──▶ 409 "dates taken"
  price the stay
  INSERT Booking + Occupancy (DIRECT)         occupancy_no_overlap ──▶ 23P01 ──▶ 409 (overlapAsConflict)
    (AWAITING_PAYMENT in the online modes, HELD offline)
  log the activity
COMMIT ──▶ 201, then the email and push go on the notify queue
```

The room lock makes requests for one room take turns, which keeps the check against imported nights correct.
That check has to be in code, because imported rows are outside the constraint (see below). The direct overlap
itself is refused by the constraint, and nothing in the code checks it first. If the lock were removed, the
constraint would still refuse the overlap.

**Requests hold the room right away.** The occupancy is active from the moment the booking is saved, not when the
owner confirms. Two guests never wait on the same nights, and the loser learns at once. An unpaid booking holds
them for 10 minutes; a booking waiting for the owner, for `holdHours` (24 by default). Each new request on a room
expires that room's stale holds, and a scheduled job expires the rest.

**The race test** (`src/modules/bookings/tests/booking-race.integration.test.ts`): one room, 20 `requestBooking` calls for the same
nights started at the same moment through `Promise.allSettled`. Exactly 1 succeeds, 19 fail with `CONFLICT`, the
database has exactly one `HELD` booking and exactly one active occupancy. A second test checks that parallel
requests for different nights all succeed.

**Seats work the same way.** Experiences sell seats in an `OfferingSession`. The `session_seats_guard` trigger
locks the session row and refuses any `SessionBooking` that would go over capacity. `session_capacity_guard`
refuses lowering capacity below seats sold. Test: 20 guests ask for the last 5 seats at once, exactly 5 get one
(`src/modules/bookings/tests/session-seats.integration.test.ts`), plus a row inserted by hand that the trigger still refuses.

## Calendar synchronization

### Import (Airbnb, Booking.com, any iCal link)

```
CalendarFeed (room, URL, source)
  │  every 15 min (scheduled job) · on "Sync now" · right before a host confirms a booking on that room
  ▼
fetch: https only, public addresses only, no redirects, 10 s timeout,
       2 MB cap enforced while streaming (a huge feed is cut off, never buffered)  (src/modules/calendar-sync/server/safe-fetch.ts)
  ▼
parse: all-day and timed events → [checkIn, checkOut) in the place's timezone;
       drop cancelled, past, > 540 days ahead and UID-less events  (src/modules/calendar-sync/server/parse-feed.ts)
  ▼
BEGIN · lock the room
  upsert Occupancy (IMPORTED) by (feedId, externalUid)    re-reading a feed never makes duplicates
  deactivate this feed's rows whose UID is gone           a platform cancellation frees the nights
  flag conflict = true on imported rows that overlap one of our DIRECT/MANUAL rows
COMMIT
  ▼
record lastSyncedAt and lastError on the feed
```

- **Duplicates.** `@@unique([feedId, externalUid])` on `Occupancy`. The platform's event UID identifies a stay.
- **Disappeared events.** Deactivated, not deleted. The nights free up.
- **A failing feed** (404, timeout, bad file) changes nothing that was already imported. The error is stored on
  the feed and shown to the host, and admins see sync health across the platform.
- **Conflicts.** If Airbnb has a stay over nights Mabeet already gave a guest, the imported row is flagged and
  shown to the host. Nothing is cancelled automatically: a person decides.
- **Why imported rows are outside the constraint.** Airbnb and Booking.com can contain overlapping stays
  themselves, and Mabeet can't refuse what already happened on another platform. Direct requests are still
  checked against imported nights in code, under the room lock, and feeds are re-read before a host confirms.

### Export

```
Room.exportToken (random, private) ──▶ GET /api/ical/{token}.ics ──▶ DIRECT and MANUAL nights, today onwards
```

The feed carries no guest names or contacts, and no imported events (echoing Airbnb's nights back to Airbnb
would make loops). An unknown token answers `404`. Event UIDs (`{occupancyId}@mabeet`) never change,
because the platforms track exported events by UID.

### What Mabeet can and cannot promise

- **Can:** no two Mabeet-controlled active occupancies overlap (constraint), and no direct request is accepted
  over a night already imported (code, under the room lock).
- **Cannot:** that Airbnb or Booking.com never sell a night Mabeet just sold. They read our export link on
  their own schedule, often every few hours. Until then a platform booking can land on the same night. The next
  sync flags it for the host.

## Queues and workers

Two processes run from one Docker image: the **website** (`pnpm start`) and the **worker** (`pnpm worker`,
`src/server/jobs/worker.ts`). They share one Postgres. The queues live there too, in pg-boss's own `pgboss`
schema. A worker takes a job with `SELECT … FOR UPDATE SKIP LOCKED`, so with several workers each job still runs
exactly once.

**Rate limits live in Redis** (`REDIS_URL`, a `redis` service in `docker-compose.prod.yml`), so every web instance shares
one count. Each hit is one atomic Lua script (`INCR`, and `PEXPIRE` on the first hit), and a window's key expires by
itself, so nothing needs cleaning up. Redis holds nothing that must survive a restart: losing it only resets the
windows. Without `REDIS_URL` (local development, tests) the counts live in the process's memory.

```
 browser ── POST /api/assistant ──▶ website ── quick? ──yes──▶ answer now (200)
                                       │
                                       no: send job ──▶ pgboss.job ◀── worker (4 AI jobs at once)
                                       │                                 │ DeepSeek, saves the chat
 browser ◀── 202 { jobId } ────────────┘                                 ▼
 browser ── GET /api/jobs/{jobId} (every 0.5–1 s) ──▶ queued · running (tool in use, reply so far)
                                                     · done (result) · failed (safe message)
```

| Queue    | Jobs                                                             | At once per worker | Retries                       | Kept after finishing |
| -------- | ---------------------------------------------------------------- | ------------------ | ----------------------------- | -------------------- |
| `ai`     | Travel assistant answer, team assistant answer, analytics report | 4                  | 1, after 5 s                  | 1 hour               |
| `notify` | Every booking, payment, refund and Contact host notice           | 8                  | 4, backing off from 30 s      | 1 day                |
| `cron`   | Calendar sync (every 15 min), housekeeping (every 5 min)         | 1                  | none: the next run comes soon | 1 day                |

**Answer now, or queue.** AI routes call `runOrQueue` (`src/server/jobs/queue.ts`) with an estimate, in seconds,
worked out from the input before the model is called (`src/modules/assistant/server/ai-jobs.ts`):

- Travel assistant: 15 s (two or three DeepSeek calls: search, maybe search again, then reply; 6–20 s measured), plus
  1 s for every 1,500 characters of the conversation sent.
- Team assistant: 20 s (it often needs a round more), plus the same per character.
- Report: 25 s + 4 s per topic + 1 s per 90 days. It writes up to 2,000 tokens whatever the input.

Work runs inside the request only when **all three** hold: the estimate is at most `JOBS_SYNC_LIMIT_SECONDS`
(5 s by default, so today every AI answer is queued; `0` queues everything), no job is waiting on that
queue (a new question must not jump the line), and this web process is running fewer than 4 such answers already.
Otherwise it is queued and the route answers `202 { status: "queued", jobId }`. Each decision is logged, e.g.
`[jobs] ai.concierge: queued (est. 15.2s, limit 10s, 0 waiting, 0 running here)`. Queueing frees the website, but
does not make an answer arrive sooner: the person still waits for the model. The browser's `api.run`
(`src/lib/api-client.ts`) handles both answers the same way, so screens don't care which path was taken. A first
model answering faster than 5 s, or a larger limit, would be answered in the request; everything else goes to the
worker, and the web process is never tied up for 30–90 seconds.

**Watching the answer arrive.** Queueing frees the website but can't make the model faster, so a queued answer
is shown as it is written:

1. The worker streams each DeepSeek call (`stream: true`, `complete(…, onText)` in `src/modules/assistant/server/deepseek.ts`).
2. The chat loop reports progress (`onProgress` in `assistant.ts`): the tool in use (`step`), then the reply so
   far (`text`).
3. The job saves it to `JobProgress` at most every 300 ms (`src/server/jobs/progress.ts`) and deletes the row
   when the job ends; housekeeping removes rows a crashed worker left behind.
4. `GET /api/jobs/{jobId}` returns it while the job runs; `api.run(url, body, onProgress)` polls every 0.5 s and
   the chat panel shows "Searching what's free…", then the reply growing word by word.

Measured on a real travel assistant question: first words at 2.3 s, search status at 2.9 s, full answer at 6.2 s. A
report shows "Writing the report…" (it is one JSON answer, nothing to show word by word).

**Safety.** A route checks the rate limit, the permission, the plan and the AI budget **before** queueing, so a
refusal is immediate. The job carries who asked (user and business ids), never a permission set: the worker looks
the member up again, so someone removed from a team while their question waited gets no answer. Only the person
who asked can read a job (`GET /api/jobs/{jobId}`); for anyone else it is "not found". A visitor's anonymous
travel assistant job is reachable only through its random UUID. Errors the user caused (no permission, over budget) are
stored as safe messages and not retried. Any other failure is retried, and the client then sees only a generic
"busy, try again" message, never the stored stack trace.

**Modes.** `JOBS_MODE=queue` in production (set in the `Dockerfile` and `docker-compose.prod.yml`) and in development:
`pnpm dev` (`scripts/dev.ts`) starts the website and the worker together, and stops both if either stops.
`inline` (the code's default, always used by the tests) runs everything in the web process with no worker: AI in
the request, notices after the response. It is for `pnpm dev:web`, the website alone on a computer short of
memory.

**Deploys.** On `SIGTERM` the worker stops taking jobs and finishes the ones in hand (up to 60 s) before exiting.
Run more workers (`docker compose -f docker-compose.prod.yml up --scale worker=2`) to share the load. A job abandoned by a crashed worker
expires and is retried.

### Scheduled jobs

| Job           | Schedule (worker)  | Also callable at              | What it does                                                                                                                         | If it never runs                                                                                           |
| ------------- | ------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Calendar sync | every 15 min (UTC) | `POST /api/cron/sync-feeds`   | Re-reads up to 20 feeds not synced in the last 15 minutes                                                                            | Feeds still refresh on "Sync now" and before every confirmation                                            |
| Housekeeping  | every 5 min (UTC)  | `POST /api/cron/expire-holds` | Re-checks online payments still pending after 2 minutes; expires unanswered and unpaid bookings; ends Whish plan months that ran out | Each new request on a room expires that room's stale holds; a returning guest's payment is checked at once |

The worker keeps the schedule in the database, so with several workers each run happens once. The HTTP endpoints
stay for a manual or outside run: both need `Authorization: Bearer $CRON_SECRET` (compared in constant time).

## Notifications

Emails (Resend) and push notifications (Web Push with VAPID keys) are sent **after** the transaction commits, as
jobs on the `notify` queue, and never throw. Each module sends its own, from `<module>-notifications.ts`
(for example `src/modules/team/server/team-notifications.ts`); the sign-in emails are in
`src/server/email/auth-emails.ts`. A mail or push
outage can't undo or slow a booking, and a failed delivery is retried up to 4 times. A job carries only ids and
amounts; the worker loads the booking fresh, so the notice reflects what is true when it is sent. Emails carry
idempotency keys, so a retry never sends one twice. A device that has unsubscribed is forgotten the next time a push to it fails.

Whoever gets an email about a booking also gets a push on every device they turned notifications on for:

- hosts and staff who can decide bookings: new requests and guest cancellations
- guests: confirmed, declined, expired, cancelled, paid and refunded, on every device of their account (booking
  needs an account)
- platform admins: AI budget warnings
- hosts and staff who can decide bookings: questions from a place's Contact host page, sent with the guest's
  address as reply-to, so answering the email reaches the guest. A host can turn this page off (WhatsApp only) for
  all their places; the route then refuses messages

Inside the app, a bell shows each person the latest five events of their businesses (or of the platform, for
admins), built from the audit log; "View all" opens the paged list.

Push subscriptions are only accepted for the browsers' own push services. A forged subscription can't make the
server call an address of the attacker's choosing.

The site is an installable web app (PWA): a web manifest, icons, and a service worker (`public/sw.js`) that
shows notifications and an offline page. Pages are never served from cache, because availability must be
live.

## Payments

Mabeet takes **no commission or fee on bookings**. In the two online modes, guests pay the full amount into
Mabeet's own Whish or Stripe account, and Mabeet owes every cent of that to the host. In offline mode the guest and
the owner arrange payment themselves, and Mabeet records nothing. Mabeet's income is plan payments only
(`PlanPayment`).

```
guest ──POST /api/public/bookings/{token}/checkout──▶ Payment (PENDING) ──▶ Whish page / Stripe Checkout
                                                                              │
          Whish callback (GET) · Stripe webhook · guest returns · cron ◀──────┘
                                   │  each only triggers:
                                   ▼
             settleOnlinePayment: ask Whish / Stripe for the real status
                                   │ paid
                                   ▼
             BEGIN · mark PAID only if still PENDING (else: already done, stop)
                   · booking AWAITING_PAYMENT and no other paid payment? → CONFIRMED
                   · otherwise (expired, cancelled, paid twice) → refund this payment in full
             COMMIT · then email + push to guest and hosts
```

- **Callbacks prove nothing.** Whish's callback is an unauthenticated GET, so it only triggers a status call to
  Whish (`src/modules/payments/server/whish.ts`). Stripe's webhook is signature-checked and still re-reads the checkout.
- **Idempotent.** The `PENDING → PAID` update is the gate: ten simultaneous callbacks confirm once (tested).
- **Refunds** (`refundForEndedBooking`): every refund of an online payment is full and automatic, whoever cancels
  (the host declining or cancelling, the guest cancelling, or the booking expiring after it was paid). Card refunds
  go through Stripe, Whish refunds through Whish. A provider error records the refund as `PENDING` for an admin to
  send by hand.
- **Payouts** (`payout-service.ts`): money for a stay becomes available once the stay (or session) has started,
  so a cancellation before then can still be refunded from it. A host asks for up to the available amount; the
  business row is locked while the balance is checked, so parallel requests can't overspend (20 at once → 1,
  tested). An admin sends the money and marks it sent with the transfer reference. Payouts go to an IBAN or a
  Whish number; Mabeet never asks for card numbers.
- **Plans**: Stripe subscriptions as before, with each paid invoice (`invoice.paid`) recorded as revenue. Or one
  month at a time with Whish; a month that runs out without a new payment returns the business to Free. Plans are
  only ever paid instantly: there is no paying by hand and no approval step, and a CHECK constraint refuses any new
  plan payment that is not Stripe or Whish. Plan limits (rooms, experiences, members, AI) are checked in the
  services that create those things.
- **Whish simulator.** Until Mabeet has Whish keys, `WHISH_MODE=simulator` serves Whish's own API from inside the
  app (`/api/whish-simulator/*`) with a payment page that follows Whish's sandbox rules (phone `96170123456`,
  OTP `111111`, wrong OTP = failed attempt, link stays payable). The real client runs unchanged against it;
  `WHISH_MODE=sandbox` points it at Whish.

## External integrations

| Service                        | Used for                      | If it's down or not configured                                        |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------- |
| Airbnb / Booking.com (iCal)    | Reading their calendars       | Feed error shown to the host. Existing imported nights stay           |
| Resend                         | Emails                        | Emails are logged instead. Bookings are unaffected                    |
| Web Push (FCM, Mozilla, Apple) | Phone notifications           | Off without VAPID keys. Failures are logged, bookings unaffected      |
| Stripe (test mode)             | Plans; guests paying by card  | Card payment is hidden. Webhooks are signature-checked and idempotent |
| Whish Pay (simulator for now)  | Guests paying; plans by Whish | Whish is hidden. Pending payments are re-checked by the scheduled job |
| DeepSeek (last bonus)          | Our own AI chats and reports  | AI shows a friendly error. Everything else works                      |
| PostgreSQL (`pgboss` schema)   | Job queues for the worker     | Same database as everything else: if it is down, so is the site       |

## AI and MCP

AI is an extra way in, not a separate system. Every AI tool (`src/modules/assistant/server/*-tools.ts`) is a Zod schema and a
call to an existing service with the caller's `TenantContext`. So the AI has exactly the permissions of the
person behind it, isolation included.

We build it in this order. First the MCP (the first AI bonus): the person's own AI app brings the model, so it needs
none of ours. Then a few host actions through the MCP. Our own model (DeepSeek) is the last bonus.

- **Owner/staff MCP** (`/api/mcp`): API key or OAuth token → membership → `TenantContext`. `list_places` shows the
  person's places, and every place-specific tool takes an optional `place`, resolved as described in the isolation
  section. The first version only reads and reports: free rooms, bookings, revenue, the commission saved and the
  numbers for a report over a period (the person's AI app writes the report); every key is read-only. Then a
  few write tools, only for the roles that allow them: cancel a booking, close or reopen dates, confirm or decline a
  request. They carry `destructiveHint`, so the client asks the person first, and read-only keys never see them.
  Every call is logged in `McpAuditLog`.
- **Guest MCP** (`/api/mcp/guest`): read-only search tools over public data: places, dates and prices. It never
  books and never sees guests' contact details. The page `/use-with-ai` explains it to guests and shows its address.
- **Our own model, last bonus:** a dashboard assistant on the same tools and context, from the
  signed-in session. A tool that changes data is not run during the chat: its checked input comes back as a
  proposal, the member sees a card with the exact action and details (not the model's wording) and presses Confirm,
  which runs the same tool, service and permission checks. Also a travel assistant on the website and written
  analytics reports. Chats are saved per person, or kept unsaved and never stored. A monthly budget in `AiUsage`:
  admins are warned at 80%, and our model pauses at 100%.

**One tool runner for every surface.** `createToolRunner` (`src/modules/assistant/server/run-tool.ts`) validates a tool's
input, runs it with the caller's context, turns failures into safe messages and reports each call to a listener.
The MCP server (`mcp-server.ts`) uses it, and so will the DeepSeek chat loop (`assistant.ts`), so they behave the same.
What the model sees (`toolPayload`) has every amount already formatted (`totalCents` + `currency` becomes
`total: "$140"`), so the model copies money and never converts cents.

**Every answer of our own model has a stated format, checked on the way back** (`src/modules/assistant/server/output.ts`). Chat prompts carry
`REPLY_FORMAT` (a small markdown subset: bold, lists, tables; no HTML, headings, code or links), and `shapeReply`
enforces it before a reply leaves the server; `RichText` renders exactly that subset and never HTML. Structured
answers go through `askForJson`: the Zod schema is sent to the model as JSON Schema, the answer is parsed and
validated, a miss is sent back once with the exact issues, and a second miss is refused (tokens are still counted).
The analytics report uses it with a strict schema whose section topics must be the ones requested.

**Kept light on purpose**, because every AI request pays for model latency already:

| What                          | How                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tool schemas                  | Each tool's JSON Schema is built once per process and cached, not on every model round                                             |
| Several tools in a round      | Run in parallel. The chat only offers read-only tools, so order can't matter                                                       |
| Audit log, usage, "last used" | Written after the response (`inBackground`), never on the request path                                                             |
| Long answers and reports      | Queued for the worker when the input is long or others are waiting (`runOrQueue`); the browser follows the job                     |
| MCP server                    | Stateless: one small server per request, registered with only the tools the caller may use                                         |
| Chat screen                   | The composer owns the draft, so typing re-renders only the input box; the message list is memoised                                 |
| Saving a chat turn            | One service call for both assistants (`answerChat` in `chat-service.ts`), which refuses a foreign chat before paying for an answer |

## Design system

Every colour, radius, shadow and easing is a token in `src/app/globals.css`, exposed to Tailwind through
`@theme`. Components use token classes (`bg-surface`, `text-muted`, `ring-line`, `bg-danger text-danger-ink`,
`backdrop:bg-scrim`), never raw colours, so light and dark mode and the five site palettes come for free.
The only fixed colours are other companies' brands (`brand-whatsapp`, `brand-airbnb`, `brand-booking`…), used
only for their logos and channel marks.

Shared building blocks live in `src/components/ui/` (`Button`, `Field`, `LabeledControl`, `FormError`,
`useConfirm`, dialogs, skeletons, and the `inputClass`, `panelClass` and `choiceChipClass` styles) and `src/hooks/` (`useAction` for calls that refresh the page, `useRedirectAction` for steps that end
on Stripe, Whish or an AI app, `useStoredChoice` for per-browser preferences). Channel colours come from one map
(`components/dashboard/channel-colors.ts`), so a channel looks the same on every chart.

Large screens are split by job rather than grown in one file. The calendar, for example, is the board
(`calendar-board.tsx`: views, selection, drag and drop), its side panel (`calendar-side-panel.tsx`), the
close-dates form (`close-dates-form.tsx`) and the pure date helpers they share (`calendar-model.ts`).

## Languages

English, Modern Standard Arabic and Lebanese Arabic (`messages/en.json`, `ar.json`, `ar-LB.json`), right to
left for both Arabic variants. A unit test fails if any language misses a string. Server error messages are
translated too. Emails to Lebanese readers use standard Arabic.

## Tests

| Kind           | Command                 | What it covers                                                                                                                                            |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | `pnpm test`             | Pricing, booking status changes, dates, permissions, iCal parse/build, privacy masking, translations, answer-now-or-queue and job states (`jobs.test.ts`) |
| Integration    | `pnpm test:integration` | Services and repositories against a real Postgres: booking flow, calendar sync, roles                                                                     |
| Database rules | (in integration)        | The constraint and triggers themselves, written to directly                                                                                               |
| Concurrency    | (in integration)        | 20 guests for the last room, 20 guests for the last 5 seats, the shared rate limit                                                                        |
| Isolation      | (in integration)        | Business A against business B, over real HTTP routes and over MCP                                                                                         |
| Smoke          | `pnpm smoke`            | Against a running app: guest, host, admin and outsider flows, iCal export over HTTP                                                                       |
| Failure cases  | `pnpm edge-cases`       | Against a running app: bad input, wrong roles, foreign ids, bad tokens, for every user type                                                               |

CI (`.github/workflows/ci.yml`) runs types, lint (including the layer rules), formatting, unused-code checks,
unit tests, a check that the generated ERD and OpenAPI files are current, and the integration tests against
Postgres 17, on every pull request and every push to `main`. Smoke and failure-case runs need a running app and
are run by hand.
