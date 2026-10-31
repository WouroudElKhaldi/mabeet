# Test plan

This file lists every test the project needs. For each test it says what it proves, why it matters, who writes it,
and how to write it.

The brief asks for:

- unit tests on the business rules,
- integration tests on the main API routes,
- a test that proves one business cannot read another business's data.

The judges also check that the main flow works **every time**.

---

## Part 1. The three kinds of test

### Unit tests

- Folder: a module's `src/modules/<name>/tests/*.test.ts`, or `tests/unit/*.test.ts` for the shared kernel.
  Command: `pnpm test`.
- Fast tests. No database. No internet.
- They test one function: prices, booking rules, dates, calendar files, input checks.
- If a function needs the database or the internet, we replace that part with a fake (a "mock").
- A unit test takes milliseconds. It never depends on the real time: pass `now` yourself.

### Integration tests

- Folder: a module's `src/modules/<name>/tests/*.integration.test.ts`, or `tests/integration/*.test.ts` for
  the kernel and tests across modules. Command: `pnpm test:integration`.
- They use a real PostgreSQL database, built from the real migrations. So the database rules and transactions are the
  same as in production.
- They call services directly, or call API routes through `tests/integration/http.ts`. Calling routes tests the whole
  path: input checks, sign-in, business checks, permissions and error codes.
- **No test ever deletes data.** Before the run, `tests/integration/global-setup.ts` only applies missing
  migrations (`prisma migrate deploy`), never a reset. The tests refuse to start unless `TEST_DATABASE_URL` is set,
  differs from `DATABASE_URL`, and names a database ending in `_test` (`tests/integration/test-database.ts`).
- Because data stays between runs, each test makes its own rows with unique names (`secureToken()` in a slug or a
  name) and only looks at those. Never count a whole table, and never delete or empty one.
- Test files run one at a time.

### End-to-end tests (e2e)

- Folder: `tests/e2e/*.spec.ts`. Command: `pnpm test:e2e`.
- They open a real browser with Playwright, on a phone-sized screen, and click through the running app like a person.
- There are only a few. They cover what must work on stage.
- They are set up once, with the first browser test (see "Setting up Playwright" below).

### Which kind to choose

| If you test…                                                                          | Use                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A calculation, a rule, a parser, an input check                                       | Unit                                           |
| A service that reads or writes the database                                           | Integration (call the service)                 |
| That a route checks input, sign-in, business and permission, and gives the right code | Integration (call the route through `http.ts`) |
| A database rule or trigger                                                            | Integration (write to the table directly)      |
| Two requests at the same moment (a race)                                              | Integration (`Promise.allSettled`)             |
| That a person can finish the main flow in a browser                                   | End-to-end                                     |

---

## Part 2. How Claude should write each kind

### Rules for every test

- **One behaviour per test.** Name it as a sentence: `it("refuses a second request for the same night")`. Not
  `it("works")`.
- **Three steps:** set up, act, check. Leave a blank line between them in longer tests.
- **No waiting and no real time.** Pass `now` to functions. Build dates with helpers (`stay(startOffset, nights)`).
- **No order between tests.** Each test makes its own data, with unique names, and only checks that data. Never
  depend on another test, and never delete or empty a table.
- **Test what people see**, not how the code works inside: the status, the rows in the database, the error code.
  (One exception: when the point is that something did **not** happen, like a tool not running before the owner
  confirms.)
- **Integration tests run jobs inline**, with no worker and no real email (`tests/integration/setup-env.ts`), so a
  notice or a bell entry can be checked right after the call: count `prisma.activityLog` rows by `action`.
- **Rate limits count in memory in tests** (no Redis). Call `resetMemoryRateLimits()` in `beforeEach` when a test
  depends on a fresh count.
- **Money comes back as numbers** (`booking.totalCents` is a `number`), so compare with numbers.
- **A test must fail when the code is wrong.** After you write a test for a rule, break the rule on purpose (remove
  the `businessId` filter, the lock, or the permission check). Check that the test fails. Then put the code back.

### A change with several steps: prove the rollback

For every service that writes in several steps, one integration test makes a later step fail (for example a room
that does not exist, a refused night, or a stubbed outside call that throws) and then checks that the database holds
nothing of the earlier steps: no booking, no occupancy, no payment row, no log line. See `02` Part 3, "All or
nothing: when one step fails".

### Checking an API by hand: Postman or Swagger

The API pull request of a task is checked by hand before review, on `pnpm dev` (http://localhost:3000) with the demo
data (`pnpm db:seed`). The routes are written in `docs/openapi.json`, so both tools read them from there.

- **Postman:** Import → `docs/openapi.json` (creates a collection with every route). Make an environment with
  `baseUrl` = `http://localhost:3000`. Sign in first with `POST /api/auth/sign-in/email` and the body `{ "email", "password" }` of a demo account (a Better Auth route, not in the contract: add it to the collection by hand). Postman
  keeps the session cookie for `localhost`, so the next calls are signed in. Workspace routes need the demo
  business's id in `{businessId}`.
- **Swagger UI:** `docker run --rm -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.json -v "${PWD}/docs:/spec"
swaggerapi/swagger-ui`, then http://localhost:8080. "Try it out" calls the app on port 3000; for signed-in
  routes, sign in on http://localhost:3000 in the same browser first.

Check, for each route of the task: the normal answer, a wrong input (400 with a clear message), no sign-in (401), a
role without the permission (403), another business's id (404), and that each answer matches `docs/openapi.json`.
Write what you checked under "How to check it" in the pull request. This is never instead of the automated tests:
it is how we see the API before the screens are built on it.

### How to write a unit test

Import the function and call it. If the module needs the database, the settings or the internet, replace them with
`vi.mock` **before** you import the module. Put shared fake data in `vi.hoisted`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ env: { AI_MONTHLY_BUDGET_USD: 50 } }));
const ledger = vi.hoisted(() => ({ spentMicro: 0 }));
vi.mock("../server/ai-usage-repository", () => ({
  sumCostSince: vi.fn(async () => ledger.spentMicro),
}));

const { assertWithinBudget } = await import("../server/ai-usage-service");

it("pauses the assistants once the budget is spent", async () => {
  ledger.spentMicro = 50_000_000;
  await expect(assertWithinBudget()).rejects.toMatchObject({ code: "UNAVAILABLE" });
});
```

To fake the internet (`fetch`), use `vi.stubGlobal("fetch", vi.fn(...))`, and `vi.unstubAllGlobals()` in
`afterEach`.

### How to write an integration test that calls services

Use the helpers in `tests/integration/helpers.ts` (from a module's tests: `@tests/integration/helpers`):

| Helper                                            | What it does                                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createUser(name)`                                | Makes a user                                                                                                                                             |
| `createPlace(name)`                               | Makes a business with an owner and its starter roles. Returns the owner, the business and the owner's context (a first room comes with the rooms module) |
| `memberWith(businessId, permissions)`             | Makes a `TenantContext` for a member with exactly these permissions                                                                                      |
| `stay(startOffset, nights)`                       | A `DateRange` that starts `startOffset` days from today (comes with the booking engine)                                                                  |
| `guestRequest(slug, roomId, startOffset, nights)` | Makes a guest account and returns a full booking request for it (async: `await` it; comes with the booking engine)                                       |

```ts
it("holds the room for the first guest and refuses the second", async () => {
  const place = await createPlace(); // { business, room, ctx }: ctx is the owner's TenantContext
  await requestBooking(await guestRequest(place.business.slug, place.room.id, 10, 2));

  await expect(
    requestBooking(await guestRequest(place.business.slug, place.room.id, 11, 2)),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
```

### How to write an integration test that calls routes

Use `tests/integration/http.ts`:

- `signUp(name)` returns a signed-in `Caller` (with its cookie).
- `call(handler, { as, params, body, query })` runs a route exactly like Next.js does, and returns the status and the
  JSON.

```ts
import { GET } from "@/app/api/workspaces/[businessId]/rooms/route";

it("answers 404 to a member of another business", async () => {
  const outsider = await signUp("Outsider");
  const { status } = await call(GET, { as: outsider, params: { businessId: otherBusinessId } });
  expect(status).toBe(404);
});
```

### How to write a race test

Start all requests at the same moment with `Promise.allSettled`. Count the results. Then check the database:

```ts
const results = await Promise.allSettled(
  Array.from({ length: 20 }, () => requestBooking(guestRequest(place.slug, place.roomId, 30, 2))),
);
expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
expect(await prisma.occupancy.count({ where: { roomId: place.roomId, active: true } })).toBe(1);
```

### How to write a database rule test

Write to the table directly with `prisma`, without the services. This proves the database itself refuses bad data,
so the rule holds even if the code has a bug.

### How to write an end-to-end test

- Use `@playwright/test`, a phone-sized screen, and a database with demo data.
- Use two browser contexts for two people (the guest and the owner).
- Find elements by role and label, for example `getByRole("button", { name: "Request" })`. Never by CSS class.
- Do not leave data that another test depends on.

---

## Part 3. The tests, feature by feature

For each row: the file, what it checks, why it matters, who writes it, and the priority.

- **P1:** must exist by Checkpoint 2 (10 November).
- **P2:** if there is time.

The owner of a feature writes its tests.

Most files below already exist in the reference project. Read them as examples. These are new and have no example
yet: `rooms.test.ts`, `booking-actions.test.ts`, `assistant-actions.test.ts`, `seed.test.ts`, and everything in
`tests/e2e/`. Write them in the same style as the files next to them.

### The server base (no feature of its own)

| File                                      | What it checks                                                                                                                                                                                                                                                                                                                       | Why                                                                            | Feature | Priority |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------- | -------- |
| `tests/unit/http-route.test.ts`           | Each error helper becomes its HTTP status and message; wrong input is 400 with the wrong fields; an unexpected error is 500 with no details and is logged; a write from another website is refused; a body that is not JSON is 400; signed out is 401; the cron secret must match exactly                                            | Every API route goes through this wrapper                                      | Base    | P1       |
| `tests/unit/schemas.test.ts`              | The shared input pieces: check-out after check-in, real dates only, international phone numbers, whole minor units, ids                                                                                                                                                                                                              | Every route reuses them                                                        | Base    | P1       |
| `tests/unit/enums.test.ts`                | Each value list covers every value its database enum allows; which statuses hold nights; which modes are paid online                                                                                                                                                                                                                 | `satisfies` alone misses a value added to the database                         | Base    | P1       |
| `tests/unit/tokens.test.ts`               | Booking references use no look-alike characters; secret links are long, URL-safe and never repeat                                                                                                                                                                                                                                    | Guests read references on the phone; links must not be guessable               | Base    | P2       |
| `tests/unit/sign-in-url.test.ts`          | After signing in, only a page on this site is opened, never another website                                                                                                                                                                                                                                                          | Stops a link from sending people to a fake site                                | Base    | P1       |
| `tests/unit/test-database.test.ts`        | The integration tests refuse to run on the development database or on any database not named `_test`                                                                                                                                                                                                                                 | No test can ever touch real data                                               | Base    | P1       |
| `tests/integration/transactions.test.ts`  | When a later step fails, the earlier steps are undone; when all succeed, all are kept; a second copy of something unique and two stays on one room night are recognised, back-to-back stays are not                                                                                                                                  | All or nothing, and the database refusals services turn into clear errors      | Base    | P1       |
| `tests/integration/money-columns.test.ts` | An LBP price above the 32-bit limit comes back exactly, as a number; an amount too large to be exact is refused                                                                                                                                                                                                                      | Money is never rounded                                                         | Base    | P1       |
| `tests/unit/jobs.test.ts`                 | A job goes on its queue with its kind and ids only and does not run in the website; inline mode runs it in the process instead; the worker finds the handler by kind; a person's error ends the job with its safe message, any other failure is thrown so it is retried; an unknown kind is refused; only missing queues are created | Emails and housekeeping must happen, even when a provider is down for a moment | Queues  | P1       |
| `tests/integration/queue.test.ts`         | On the real pg-boss (queue mode): every queue exists; an invitation's email is stored on the notify queue, not sent by the website, and sent when the worker runs it                                                                                                                                                                 | The queue as it runs in production                                             | Queues  | P1       |

### Booking rules (no database)

| File                                                | What it checks                                                                                                                                       | Why                                      | Feature | Priority |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------- | -------- |
| `src/modules/bookings/tests/booking-policy.test.ts` | Where a booking starts in each of the three modes; the 10-minute payment window; the owner's answer time; an online payment is always the full total | These rules decide money and nights      | F3      | P1       |
| `src/modules/bookings/tests/booking-status.test.ts` | Every allowed status change works; a confirmed booking cannot go back to held; declined, expired and cancelled are final                             | Stops impossible states                  | F3      | P1       |
| `src/modules/rooms/tests/pricing.test.ts`           | The total is the sum of the nightly prices; special prices replace the base price on their nights                                                    | Every price a guest sees comes from here | F2      | P1       |
| `tests/unit/dates.test.ts`                          | Reading dates; counting nights (the check-out night is free); ranges that only touch do not overlap                                                  | A wrong date creates double bookings     | Base    | P1       |

### The booking flow and "no double bookings"

| File                                                                  | What it checks                                                                                                                                                                                                                                                                                                                                                                  | Why                                                | Feature | Priority |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- | -------- |
| `src/modules/bookings/tests/occupancy-constraint.integration.test.ts` | The database refuses two active overlapping stays; touching stays are allowed; inactive rows do not block; imported rows may overlap each other; check-out must be after check-in                                                                                                                                                                                               | Proves the database itself refuses double bookings | F3      | P1       |
| `src/modules/bookings/tests/booking-race.integration.test.ts`         | 20 requests at the same moment for the same nights: exactly 1 succeeds, 19 get "dates taken", exactly 1 active stay; 20 requests for different nights all succeed                                                                                                                                                                                                               | Proves the last room goes to one guest only        | F3      | P1       |
| `src/modules/bookings/tests/booking-flow.integration.test.ts`         | A request holds the room; an LBP stay whose total passes the 32-bit limit is priced exactly and read back as a number; the owner confirms; declining frees the nights; an expired hold frees the nights and cannot be confirmed; an Airbnb night blocks a request; wrong input gives 400; past, too long or too far dates are refused; room size and minimum nights are checked | The whole main flow, on the server                 | F3      | P1       |
| `src/modules/bookings/tests/guest-cancel.integration.test.ts`         | The guest cancels with the private link before check-in; not after; the nights are freed; a paid booking is refunded in full                                                                                                                                                                                                                                                    | Guests can cancel without calling the host         | F4      | P2       |

### Calendar sync and closed dates

| File                                                           | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                  | Feature                                  | Priority |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | -------- |
| `src/modules/calendar-sync/tests/ical.test.ts`                 | Airbnb-style events become the right nights; time zones are respected; a missing end means one night; cancelled, past, far and id-less events are skipped; our calendar link has no guest details; private and http links are refused; non-calendar files are refused; files over 2 MB are stopped                                                                                                                                                                                           | Calendar sync is half of the brief                   | F10                                      | P1       |
| `src/modules/calendar-sync/tests/calendar.integration.test.ts` | Syncing creates imported rows; syncing again makes no copies; a removed event frees its nights; a clash is marked, not cancelled, and the hosts are alerted once (bell entry); it clears when the platform cancels (next sync) and at once when the host cancels our booking or removes closed dates; closing dates over platform nights flags a clash at once; a failing link keeps old data and saves the error; closing taken nights is refused; confirming re-reads the room's calendars | Import, refresh and closed dates work with real data | F10 (sync and board), F11 (closed dates) | P1       |

### Rooms and prices

| File                                                             | What it checks                                                                                                                                                                                                                    | Why                                          | Feature | Priority |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------- | -------- |
| `src/modules/rooms/tests/rooms.integration.test.ts`              | The owner adds and edits a room; staff without `rooms.manage` get 403 through the route; the plan limit stops an extra room; `findRoomByNameOrId` finds by id, exact name and unique part, and refuses a name that fits two rooms | Rooms are the base of every booking          | F7      | P1       |
| `src/modules/rooms/tests/reviews-and-prices.integration.test.ts` | A special price changes the price for those nights only; clearing it goes back to the base price; more than 366 nights is refused                                                                                                 | The price shown must equal the price charged | F7      | P2       |

### The owner's bookings and decisions

| File                                                             | What it checks                                                                                                                                        | Why                                             | Feature | Priority |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------- | -------- |
| `src/modules/bookings/tests/booking-actions.integration.test.ts` | Confirm, decline and cancel through the route; a member without `bookings.decide` gets 403; staff without `guests.contact` see hidden phone and email | The owner's daily work, and privacy             | F9      | P1       |
| `src/modules/bookings/tests/privacy.test.ts`                     | Hiding phone numbers and emails                                                                                                                       | Staff must not see what they are not allowed to | F17     | P2       |

### Businesses, roles and permissions

| File                                                             | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Why                                                    | Feature   | Priority |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------- | -------- |
| `tests/unit/permissions.test.ts`                                 | The owner role has every permission; read-only keeps only read permissions; unknown permission names are ignored; nobody can give what they do not have                                                                                                                                                                                                                                                                                                                         | The base of "least privilege"                          | Base      | P1       |
| `tests/integration/tenant-isolation.test.ts`                     | For rooms, bookings, calendar, team, settings and analytics: A's owner calling B's routes with B's real ids gets 404, and B's data does not change; a guest's private link shows only that booking                                                                                                                                                                                                                                                                              | The brief asks for this test                           | Isolation | P1       |
| `src/modules/team/tests/roles.integration.test.ts`               | Front desk can confirm bookings but gets 403 on analytics and settings; an owner makes a role; nobody gives a permission they lack; the owner role cannot be changed or deleted; nobody changes their own access; only an owner makes an owner                                                                                                                                                                                                                                  | "At least two roles" in the brief                      | F13       | P1       |
| `src/modules/workspaces/tests/workspaces.integration.test.ts`    | Creating a place makes the creator its owner with every permission and adds the starter roles; two places with one name get different links; when a step fails, no place and no role is saved                                                                                                                                                                                                                                                                                   | Every owner starts here, and it must be all or nothing | F17       | P1       |
| `src/modules/team/tests/invitations.integration.test.ts`         | A new person registers from the link and joins with exactly the invited role; someone with an account accepts only with the invited email; expired and cancelled links are refused; one waiting invitation per person; the invitation email carries the link, in the host's language (Arabic right to left), and the host hears when the person joins; a cancelled invitation sends nothing; a Free team stops at two, and nobody gets an account when the team is already full | Staff join only with the role the host chose           | F13       | P1       |
| `src/modules/accounts/tests/accounts.integration.test.ts`        | Closing an account marks it deleted, frees the email and ends every session; the email must be typed exactly; the only owner of a place cannot leave; Download my data gives only the person's own data                                                                                                                                                                                                                                                                         | F17 and privacy: nothing is deleted, nothing leaks     | F17       | P1       |
| `src/modules/accounts/tests/platform-admins.integration.test.ts` | `pnpm admins:create` makes a verified admin who signs in and reaches any place on the website, never through an AI key; running it again makes no copy and only the new password works                                                                                                                                                                                                                                                                                          | Only this script makes admins                          | Base      | P1       |

### Analytics and the money saved

| File                                                        | What it checks                                                                                                                                                                                                          | Why                                           | Feature | Priority |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------- | -------- |
| `src/modules/analytics/tests/analytics.integration.test.ts` | Direct revenue counts only confirmed bookings; money saved = revenue × the commission rate; nights by channel match the stays; totals across places add up and never mix currencies; other businesses are never counted | This is the number on stage. It must be right | F12     | P1       |

### Money

| File                                                    | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Why                                                                  | Feature   | Priority |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | -------- |
| `src/modules/payments/tests/whish.test.ts`              | The Whish client sends the right request and headers; an "unknown result" answer is an error, never "paid"; simulator mode calls the app itself; without keys it calls nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                           | A wrong reading could confirm an unpaid booking                      | F4a, F15  | P1       |
| `src/modules/billing/tests/stripe.test.ts`              | Webhook signatures: right secret, untouched body, recent timestamp, nothing else; a plan checkout carries the business id and finds the customer by id or by email, never both; an outage is a calm 503; no key calls nothing                                                                                                                                                                                                                                                                                                                                                                                                            | A forged event must never change a plan                              | F15       | P1       |
| `src/modules/billing/tests/billing.integration.test.ts` | A Free place stops at 3 rooms, 1 experience and 2 people, deleted ones do not count, Pro lifts it; only an owner pays; Stripe moves a place to Pro and back to Free, applies a replayed event once, records each invoice once, keeps nothing of an event that fails halfway and rejects unsigned ones; a Whish month paid on the simulator end to end (a wrong code changes nothing, a second month follows on, a repeated callback adds nothing); Whish down leaves nothing pending; housekeeping ends a lapsed Whish month, leaves card plans to Stripe and settles a payment whose callback was lost; the cron route needs its secret | Plans are the platform's income: never doubled, never given for free | F15       | P2       |
| `src/modules/payments/tests/money.integration.test.ts`  | A paid payment confirms the booking once, even with 10 callbacks at once; mode 1 confirms on payment and mode 2 waits for the owner; an unpaid booking is cancelled after 10 minutes and its nights are free; a mode 2 booking the owner never answers expires with a full refund; every cancellation of a paid booking is refunded in full; a payment after the booking ended is refunded in full; a payout cannot be more than what is available (20 requests at once → 1)                                                                                                                                                             | Money is never doubled or lost                                       | F4a, F12a | P1       |

### Near your stay and partners

| File                                                      | What it checks                                                                                                                                                                                                       | Why                                                               | Feature | Priority |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------- | -------- |
| `src/modules/directory/tests/nearby.integration.test.ts`  | Only experiences and services in the place's region with a session during the guest's nights are shown, nearest first; full, inactive, deleted and other regions' ones never are                                     | The guest sees only what they can really join                     | F22     | P2       |
| `src/modules/partners/tests/partners.integration.test.ts` | Only platform admins add, change or remove partners and sponsorships; a sponsored item comes first only inside its dates and always carries the sponsored mark; a removed partner disappears and can be brought back | Sponsored places are never hidden ads, and only admins place them | F23     | P2       |

### AI

| File                                                                | What it checks                                                                                                                                                                                                                                                                                              | Why                                                          | Feature | Priority |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- | -------- |
| `src/modules/assistant/tests/assistant.test.ts`                     | A change the model asks for becomes a proposal and does not run; a proposal with wrong input is refused (no card); read-only tools still run at once; without proposals (MCP), changes run directly                                                                                                         | Proves the AI is checked before it acts                      | F14     | P1       |
| `src/modules/assistant/tests/ai-output.test.ts`                     | Chat replies are shaped to the stated format (HTML, code and links dropped; empty becomes the fallback; long replies cut); a JSON answer gets its schema, a wrong one is sent back once and then refused, with every token counted; money reaches the model already formatted                               | Proves every AI answer is checked before anyone sees it      | F14     | P1       |
| `src/modules/assistant/tests/mcp-server.test.ts`                    | Tools are listed with "read only" and "changes data" marks; a tool runs with the caller's context; errors come back as tool errors, with no internal details                                                                                                                                                | Claude, Cursor and Codex rely on this                        | F14     | P1       |
| `src/modules/assistant/tests/ai-usage.test.ts`                      | Answers under the budget; pauses at 100%; cost comes from tokens; admins are told once at 80% and once at 100%                                                                                                                                                                                              | Cost control                                                 | F14     | P1       |
| `src/modules/assistant/tests/mcp-isolation.integration.test.ts`     | A key only reaches its own business; a read-only key cannot see or call change tools; `place` only reaches the person's own places; a removed member's key stops working                                                                                                                                    | The AI never crosses into another business                   | F14     | P1       |
| `src/modules/assistant/tests/assistant-actions.integration.test.ts` | The actions route runs a confirmed `close_dates` and the calendar shows it; an unknown tool, or one the member lacks, is refused; a read-only tool name is refused                                                                                                                                          | The Confirm button is as safe as the dashboard buttons       | F14     | P1       |
| `src/modules/assistant/tests/chats.integration.test.ts`             | Saved chats keep their order; someone else's chat is never opened (404); unsaved chats are never stored                                                                                                                                                                                                     | Privacy of AI chats                                          | F14     | P2       |
| `src/modules/assistant/tests/deepseek-stream.test.ts`               | Streamed text is added up and passed on; a tool call split over events is rebuilt exactly; streaming (with usage) is asked for only when someone listens                                                                                                                                                    | The live answer must be exactly the real answer              | F14b    | P1       |
| `src/modules/directory/tests/place-search.integration.test.ts`      | "North Lebanon" or "الشمال" finds places in its towns; bedrooms, bathrooms and a jacuzzi filter the rooms and are shown; nothing is returned rather than a near miss                                                                                                                                        | The guest MCP must find what was asked, or say there is none | F1, F6  | P1       |
| `tests/unit/regions.test.ts`                                        | Each region's spellings turn into its towns; a town stays as typed                                                                                                                                                                                                                                          | Region search                                                | Base    | P2       |
| `src/modules/assistant/tests/concierge-cards.test.ts`               | A place found by two searches is shown once, with the later price                                                                                                                                                                                                                                           | No duplicate cards                                           | F6      | P2       |
| `tests/unit/jobs.test.ts`                                           | A short question on a quiet server is answered in the request; a long one, or any while jobs wait, is queued and not run; inline mode never queues; a user's error is stored safely and not retried; a crash is retried; a stored stack trace never reaches the client; a job's kind and its data never mix | Proves slow AI never ties up the website, and is safe        | Queues  | P1       |

### Quality of the whole app

| File                                   | What it checks                                                                                                                                                             | Why                                                       | Feature | Priority |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------- | -------- |
| `tests/integration/rate-limit.test.ts` | 20 requests at once against a limit of N: exactly N pass; it says when to retry; a fresh window starts when the old one ends (in-memory store; production counts in Redis) | Public forms and AI cost money if abused                  | Base    | P2       |
| `tests/unit/background.test.ts`        | Side work does not make the request wait; a failing email is logged and never breaks the request                                                                           | "An email problem never breaks a booking"                 | Queues  | P1       |
| By hand, with `pnpm worker`            | A queued notice is sent by the worker; a long chat comes back through `/api/jobs/{jobId}`; the schedules run                                                               | The worker is a second process; check it once per release | Queues  | P1       |
| `tests/unit/messages.test.ts`          | Every English key is in Arabic (and Lebanese Arabic), nothing extra, no empty texts                                                                                        | A missing key shows a raw key on stage                    | Base    | P1       |
| `tests/unit/openapi.test.ts`           | Every API route is in `docs/openapi.json`                                                                                                                                  | The brief asks for the API contract                       | Docs    | P1       |
| `tests/unit/email.test.ts`             | Guest text is made safe in emails; the plain-text version has the link; Arabic is right-to-left                                                                            | Emails must not let guests inject code                    | F4      | P2       |
| `tests/unit/send-email.test.ts`        | Reserved test addresses (`.test`, `.example`) are never sent to; only real addresses go to Resend                                                                          | Demo and test accounts must not cause failed sends        | F4      | P2       |
| `tests/unit/auth-emails.test.ts`       | The confirmation and password-reset emails carry their link, greet by first name, and come in Arabic, right to left, for Arabic speakers                                   | People must be able to sign in                            | F17     | P1       |
| `tests/unit/request-locale.test.ts`    | The visitor's language: their saved choice, else the browser's (Lebanese Arabic, Arabic or English)                                                                        | Emails and answers come in the right language             | F18     | P2       |

### Demo data

| File                             | What it checks                                                                                                                                          | Why                                     | Feature   | Priority |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------- | -------- |
| `tests/integration/seed.test.ts` | The demo data can run twice without copies; no name has "test", "demo" or fake Latin; every phone starts with `+961`; every place has rooms with prices | The demo must look like a real business | Demo data | P2       |

---

## Part 4. End-to-end tests (Playwright)

| File                                     | What it does                                                                                                                                                                                                                                                    | Why                                          | Feature | Priority |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------- | -------- |
| `tests/e2e/core-flow.spec.ts`            | On a 390 px phone: a guest opens a place, picks free dates (a taken night cannot be picked), sends a request and sees the confirmation page. In a second browser, the signed-in owner sees the request and confirms it. The guest's page then shows "confirmed" | The exact flow shown on stage                | Quality | P1       |
| `tests/e2e/double-booking.spec.ts`       | Two guests in two browsers ask for the same night at the same time. One sees the confirmation. The other sees "Those dates were just taken"                                                                                                                     | The "never double-booked" moment of the demo | Quality | P1       |
| `tests/e2e/ai-action.spec.ts`            | The owner asks the assistant to close dates, sees the card with the exact room and dates, presses Confirm, and the calendar shows them closed (with a fake model, see below)                                                                                    | The confirm card is as safe as the buttons   | F14     | P2       |
| `tests/e2e/mobile-and-languages.spec.ts` | Every page of the main flow at 390 px has no sideways scrolling, in English and Arabic                                                                                                                                                                          | "Comfortable on a phone" in the brief        | Quality | P2       |

### A scripted AI model, used only by tests

Automated tests must **not** call the real AI model. It costs money, and its answers change every time.

- Add a permanent setting (for example `AI_PROVIDER=scripted`) read in `src/modules/assistant/server/deepseek.ts`.
- When it is set, the model gives fixed answers to known questions.
- Only test runs set it. Production never does. It is part of the test setup, not a temporary shortcut.

---

## Part 5. Running the tests

### On your computer

1. `pnpm db:start` (the project's own database; leave it running).
2. `pnpm test` for unit tests.
3. `pnpm test:integration` for integration tests. They only add rows to the test database set in
   `TEST_DATABASE_URL` (a database ending in `_test`) and never delete anything; they refuse to run on any other.
4. `pnpm test:e2e` for end-to-end tests, with the app running on a database with demo data.

On a computer with little memory, stop `pnpm dev` before the checks or tests, and run one big command at a time.

### On GitHub (CI)

Every pull request runs: types, lint, format, unused code, unit tests, the documents check, and the integration
tests with a real database. A red check blocks the merge. End-to-end tests can run on a schedule, or before a
release, if they are too slow for every pull request.

### Setting up Playwright (once, in the new repository)

The first person who writes a browser test does this:

- Add `@playwright/test` as a dev package.
- Add `playwright.config.ts` with a `mobile` project (390 × 844, a phone browser) and a `webServer` that starts the
  app.
- Add the `tests/e2e/` folder and the `test:e2e` script.
- Keep e2e tests out of the Vitest projects.
- Fill a separate database with demo data before the run.

---

## Part 6. The minimum at each checkpoint

### Checkpoint 1 (Tuesday 3 November)

- Unit: `booking-policy`, `booking-status`, `pricing`, `dates`.
- Integration: `occupancy-constraint`, `booking-race`, `booking-flow`, and a first version of `tenant-isolation`.

### Checkpoint 2 (Tuesday 10 November)

Every **P1** test above, including `core-flow.spec.ts` and `double-booking.spec.ts`.

### Submission (Friday 13 November)

All P1 tests green on GitHub, and as many P2 tests as time allows. `docs/requirements-matrix.md` links each
requirement to the test that proves it.
