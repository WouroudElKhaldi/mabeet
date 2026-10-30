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

- Folder: `tests/unit/*.test.ts`. Command: `pnpm test`.
- Fast tests. No database. No internet.
- They test one function: prices, booking rules, dates, calendar files, input checks.
- If a function needs the database or the internet, we replace that part with a fake (a "mock").
- A unit test takes milliseconds. It never depends on the real time: pass `now` yourself.

### Integration tests

- Folder: `tests/integration/*.test.ts`. Command: `pnpm test:integration`.
- They use a real PostgreSQL database, built from the real migrations. So the database rules and transactions are the
  same as in production.
- They call services directly, or call API routes through `tests/integration/http.ts`. Calling routes tests the whole
  path: input checks, sign-in, business checks, permissions and error codes.
- The test database is **wiped** before the run. Each test file starts with `resetDatabase()`.
- Test files run one at a time.

### End-to-end tests (e2e)

- Folder: `tests/e2e/*.spec.ts`. Command: `pnpm test:e2e`.
- They open a real browser with Playwright, on a phone-sized screen, and click through the running app like a person.
- There are only a few. They cover what must work on stage.
- Task 9C sets them up.

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
- **No order between tests.** Each test makes its own data. Never depend on another test.
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

### How to write a unit test

Import the function and call it. If the module needs the database, the settings or the internet, replace them with
`vi.mock` **before** you import the module. Put shared fake data in `vi.hoisted`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ env: { AI_MONTHLY_BUDGET_USD: 50 } }));
const ledger = vi.hoisted(() => ({ spentMicro: 0 }));
vi.mock("@/server/repositories/ai-usage-repository", () => ({
  sumCostSince: vi.fn(async () => ledger.spentMicro),
}));

const { assertWithinBudget } = await import("@/server/services/ai-usage-service");

it("pauses the assistants once the budget is spent", async () => {
  ledger.spentMicro = 50_000_000;
  await expect(assertWithinBudget()).rejects.toMatchObject({ code: "UNAVAILABLE" });
});
```

To fake the internet (`fetch`), use `vi.stubGlobal("fetch", vi.fn(...))`, and `vi.unstubAllGlobals()` in
`afterEach`.

### How to write an integration test that calls services

Use the helpers in `tests/integration/helpers.ts`:

| Helper                                            | What it does                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `resetDatabase()`                                 | Waits for background work (emails) to finish, then empties every table                    |
| `createUser(name)`                                | Makes a user                                                                              |
| `createPlace(name, plan)`                         | Makes a business with an owner, roles and a room. Returns the ids and the owner's context |
| `memberWith(businessId, permissions)`             | Makes a `TenantContext` for a member with exactly these permissions                       |
| `stay(startOffset, nights)`                       | A `DateRange` that starts `startOffset` days from today                                   |
| `guestRequest(slug, roomId, startOffset, nights)` | Makes a guest account and returns a full booking request for it (async: `await` it)       |

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

### Booking rules (no database)

| File                                | What it checks                                                                                                                                       | Why                                      | Task | Priority |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---- | -------- |
| `tests/unit/booking-policy.test.ts` | Where a booking starts in each of the three modes; the 10-minute payment window; the owner's answer time; an online payment is always the full total | These rules decide money and nights      | 3A   | P1       |
| `tests/unit/booking-status.test.ts` | Every allowed status change works; a confirmed booking cannot go back to held; declined, expired and cancelled are final                             | Stops impossible states                  | 3A   | P1       |
| `tests/unit/pricing.test.ts`        | The total is the sum of the nightly prices; special prices replace the base price on their nights                                                    | Every price a guest sees comes from here | 2C   | P1       |
| `tests/unit/dates.test.ts`          | Reading dates; counting nights (the check-out night is free); ranges that only touch do not overlap                                                  | A wrong date creates double bookings     | 1A   | P1       |

### The booking flow and "no double bookings"

| File                                             | What it checks                                                                                                                                                                                                                                                                                                                                                                  | Why                                                | Task | Priority |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---- | -------- |
| `tests/integration/occupancy-constraint.test.ts` | The database refuses two active overlapping stays; touching stays are allowed; inactive rows do not block; imported rows may overlap each other; check-out must be after check-in                                                                                                                                                                                               | Proves the database itself refuses double bookings | 3A   | P1       |
| `tests/integration/booking-race.test.ts`         | 20 requests at the same moment for the same nights: exactly 1 succeeds, 19 get "dates taken", exactly 1 active stay; 20 requests for different nights all succeed                                                                                                                                                                                                               | Proves the last room goes to one guest only        | 3A   | P1       |
| `tests/integration/booking-flow.test.ts`         | A request holds the room; an LBP stay whose total passes the 32-bit limit is priced exactly and read back as a number; the owner confirms; declining frees the nights; an expired hold frees the nights and cannot be confirmed; an Airbnb night blocks a request; wrong input gives 400; past, too long or too far dates are refused; room size and minimum nights are checked | The whole main flow, on the server                 | 3A   | P1       |
| `tests/integration/guest-cancel.test.ts`         | The guest cancels with the private link before check-in; not after; the nights are freed; the refund follows the policy                                                                                                                                                                                                                                                         | Guests can cancel without calling the host         | 7A   | P2       |

### Calendar sync and closed dates

| File                                 | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Why                                                  | Task                                     | Priority |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | -------- |
| `tests/unit/ical.test.ts`            | Airbnb-style events become the right nights; time zones are respected; a missing end means one night; cancelled, past, far and id-less events are skipped; our calendar link has no guest details; private and http links are refused; non-calendar files are refused; files over 2 MB are stopped                                                                                                                                                                                                                                                  | Calendar sync is half of the brief                   | 6A                                       | P1       |
| `tests/integration/calendar.test.ts` | Syncing creates imported rows; syncing again makes no copies; a removed event frees its nights; a clash is marked, not cancelled, and the hosts are alerted once (bell entry); it clears when the platform cancels (next sync) and at once when the host cancels our booking or removes closed dates; closing dates over platform nights flags a clash at once; a failing link keeps old data and saves the error; closing taken nights is refused; moving closed dates works but never onto taken nights; confirming re-reads the room's calendars | Import, refresh and closed dates work with real data | 6A (sync), 3B (closed dates), 5B (board) | P1       |

### Rooms and prices

| File                                           | What it checks                                                                                                                                                                                                                    | Why                                          | Task | Priority |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---- | -------- |
| `tests/integration/rooms.test.ts`              | The owner adds and edits a room; staff without `rooms.manage` get 403 through the route; the plan limit stops an extra room; `findRoomByNameOrId` finds by id, exact name and unique part, and refuses a name that fits two rooms | Rooms are the base of every booking          | 3B   | P1       |
| `tests/integration/reviews-and-prices.test.ts` | A special price changes the price for those nights only; clearing it goes back to the base price; more than 366 nights is refused                                                                                                 | The price shown must equal the price charged | 3B   | P2       |

### The owner's bookings and decisions

| File                                        | What it checks                                                                                                                                        | Why                                             | Task | Priority |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---- | -------- |
| `tests/integration/booking-actions.test.ts` | Confirm, decline and cancel through the route; a member without `bookings.decide` gets 403; staff without `guests.contact` see hidden phone and email | The owner's daily work, and privacy             | 4B   | P1       |
| `tests/unit/privacy.test.ts`                | Hiding phone numbers and emails                                                                                                                       | Staff must not see what they are not allowed to | 2B   | P2       |

### Businesses, roles and permissions

| File                                         | What it checks                                                                                                                                                                                                                                 | Why                               | Task    | Priority |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- | -------- |
| `tests/unit/permissions.test.ts`             | The owner role has every permission; read-only keeps only read permissions; unknown permission names are ignored; nobody can give what they do not have                                                                                        | The base of "least privilege"     | 1C      | P1       |
| `tests/integration/tenant-isolation.test.ts` | For rooms, bookings, calendar, team, settings and analytics: A's owner calling B's routes with B's real ids gets 404, and B's data does not change; a guest's private link shows only that booking                                             | The brief asks for this test      | 2A, 10A | P1       |
| `tests/integration/roles.test.ts`            | Front desk can confirm bookings but gets 403 on analytics and settings; an owner makes a role; nobody gives a permission they lack; the owner role cannot be changed or deleted; nobody changes their own access; only an owner makes an owner | "At least two roles" in the brief | 6B      | P1       |

### Analytics and the money saved

| File                                  | What it checks                                                                                                                                                                                                          | Why                                           | Task | Priority |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---- | -------- |
| `tests/integration/analytics.test.ts` | Direct revenue counts only confirmed bookings; money saved = revenue × the commission rate; nights by channel match the stays; totals across places add up and never mix currencies; other businesses are never counted | This is the number on stage. It must be right | 8B   | P1       |

### Money

| File                              | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Why                                             | Task             | Priority |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------- | -------- |
| `tests/unit/whish.test.ts`        | The Whish client sends the right request; an "unknown result" answer is an error, never "paid"                                                                                                                                                                                                                                                                                                                                                                               | A wrong reading could confirm an unpaid booking | 4A               | P1       |
| `tests/integration/money.test.ts` | A paid payment confirms the booking once, even with 10 callbacks at once; mode 1 confirms on payment and mode 2 waits for the owner; an unpaid booking is cancelled after 10 minutes and its nights are free; a mode 2 booking the owner never answers expires with a full refund; every cancellation of a paid booking is refunded in full; a payment after the booking ended is refunded in full; a payout cannot be more than what is available (20 requests at once → 1) | Money is never doubled or lost                  | 4A, 8A (payouts) | P1       |

### AI

| File                                          | What it checks                                                                                                                                                                                                                                                                                              | Why                                                          | Task   | Priority |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ | -------- |
| `tests/unit/assistant.test.ts`                | A change the model asks for becomes a proposal and does not run; a proposal with wrong input is refused (no card); read-only tools still run at once; without proposals (MCP), changes run directly                                                                                                         | Proves the AI is checked before it acts                      | 9A     | P1       |
| `tests/unit/ai-output.test.ts`                | Chat replies are shaped to the stated format (HTML, code and links dropped; empty becomes the fallback; long replies cut); a JSON answer gets its schema, a wrong one is sent back once and then refused, with every token counted; money reaches the model already formatted                               | Proves every AI answer is checked before anyone sees it      | 9A     | P1       |
| `tests/unit/mcp-server.test.ts`               | Tools are listed with "read only" and "changes data" marks; a tool runs with the caller's context; errors come back as tool errors, with no internal details                                                                                                                                                | Claude, Cursor and Codex rely on this                        | B4     | P1       |
| `tests/unit/ai-usage.test.ts`                 | Answers under the budget; pauses at 100%; cost comes from tokens; admins are told once at 80% and once at 100%                                                                                                                                                                                              | Cost control                                                 | 9A     | P1       |
| `tests/integration/mcp-isolation.test.ts`     | A key only reaches its own business; a read-only key cannot see or call change tools; `place` only reaches the person's own places; a removed member's key stops working                                                                                                                                    | The AI never crosses into another business                   | B4     | P1       |
| `tests/integration/assistant-actions.test.ts` | The actions route runs a confirmed `close_dates` and the calendar shows it; an unknown tool, or one the member lacks, is refused; a read-only tool name is refused                                                                                                                                          | The Confirm button is as safe as the dashboard buttons       | 9A     | P1       |
| `tests/integration/chats.test.ts`             | Saved chats keep their order; someone else's chat is never opened (404); unsaved chats are never stored                                                                                                                                                                                                     | Privacy of AI chats                                          | 9A     | P2       |
| `tests/unit/deepseek-stream.test.ts`          | Streamed text is added up and passed on; a tool call split over events is rebuilt exactly; streaming (with usage) is asked for only when someone listens                                                                                                                                                    | The live answer must be exactly the real answer              | B10    | P1       |
| `tests/integration/place-search.test.ts`      | "North Lebanon" or "الشمال" finds places in its towns; bedrooms, bathrooms and a jacuzzi filter the rooms and are shown; nothing is returned rather than a near miss                                                                                                                                        | The concierge must find what was asked, or say there is none | 5C, B3 | P1       |
| `tests/unit/regions.test.ts`                  | Each region's spellings turn into its towns; a town stays as typed                                                                                                                                                                                                                                          | Region search                                                | 1C     | P2       |
| `tests/unit/concierge-cards.test.ts`          | A place found by two searches is shown once, with the later price                                                                                                                                                                                                                                           | No duplicate cards                                           | B3     | P2       |
| `tests/unit/jobs.test.ts`                     | A short question on a quiet server is answered in the request; a long one, or any while jobs wait, is queued and not run; inline mode never queues; a user's error is stored safely and not retried; a crash is retried; a stored stack trace never reaches the client; a job's kind and its data never mix | Proves slow AI never ties up the website, and is safe        | 5A     | P1       |

### Quality of the whole app

| File                                   | What it checks                                                                                                                                                             | Why                                                       | Task | Priority |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- | -------- |
| `tests/integration/rate-limit.test.ts` | 20 requests at once against a limit of N: exactly N pass; it says when to retry; a fresh window starts when the old one ends (in-memory store; production counts in Redis) | Public forms and AI cost money if abused                  | 1A   | P2       |
| `tests/unit/background.test.ts`        | Side work does not make the request wait; a failing email is logged and never breaks the request                                                                           | "An email problem never breaks a booking"                 | 5A   | P1       |
| By hand, with `pnpm worker`            | A queued notice is sent by the worker; a long chat comes back through `/api/jobs/{jobId}`; the schedules run                                                               | The worker is a second process; check it once per release | 5A   | P1       |
| `tests/unit/messages.test.ts`          | Every English key is in Arabic (and Lebanese Arabic), nothing extra, no empty texts                                                                                        | A missing key shows a raw key on stage                    | 1C   | P1       |
| `tests/unit/openapi.test.ts`           | Every API route is in `docs/openapi.json`                                                                                                                                  | The brief asks for the API contract                       | 11C  | P1       |
| `tests/unit/email.test.ts`             | Guest text is made safe in emails; the plain-text version has the link; Arabic is right-to-left                                                                            | Emails must not let guests inject code                    | 7A   | P2       |
| `tests/unit/send-email.test.ts`        | Reserved test addresses (`.test`, `.example`) are never sent to; only real addresses go to Resend                                                                          | Demo and test accounts must not cause failed sends        | 7A   | P2       |

### Demo data

| File                             | What it checks                                                                                                                                          | Why                                     | Task | Priority |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---- | -------- |
| `tests/integration/seed.test.ts` | The demo data can run twice without copies; no name has "test", "demo" or fake Latin; every phone starts with `+961`; every place has rooms with prices | The demo must look like a real business | 8C   | P2       |

---

## Part 4. End-to-end tests (Playwright)

| File                                     | What it does                                                                                                                                                                                                                                                    | Why                                          | Task | Priority |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---- | -------- |
| `tests/e2e/core-flow.spec.ts`            | On a 390 px phone: a guest opens a place, picks free dates (a taken night cannot be picked), sends a request and sees the confirmation page. In a second browser, the signed-in owner sees the request and confirms it. The guest's page then shows "confirmed" | The exact flow shown on stage                | 9C   | P1       |
| `tests/e2e/double-booking.spec.ts`       | Two guests in two browsers ask for the same night at the same time. One sees the confirmation. The other sees "Those dates were just taken"                                                                                                                     | The "never double-booked" moment of the demo | 9C   | P1       |
| `tests/e2e/ai-action.spec.ts`            | The owner asks the assistant to close dates, sees the card with the exact room and dates, presses Confirm, and the calendar shows them closed (with a fake model, see below)                                                                                    | The AI moment of the demo                    | 10B  | P2       |
| `tests/e2e/mobile-and-languages.spec.ts` | Every page of the main flow at 390 px has no sideways scrolling, in English and Arabic                                                                                                                                                                          | "Comfortable on a phone" in the brief        | 9C   | P2       |

### A scripted AI model, used only by tests

Automated tests must **not** call the real AI model. It costs money, and its answers change every time.

- Add a permanent setting (for example `AI_PROVIDER=scripted`) read in `src/server/ai/deepseek.ts`.
- When it is set, the model gives fixed answers to known questions.
- Only test runs set it. Production never does. It is part of the test setup, not a temporary shortcut.

---

## Part 5. Running the tests

### On your computer

1. `pnpm db:start` (the project's own database; leave it running).
2. `pnpm test` for unit tests.
3. `pnpm test:integration` for integration tests. This **wipes the test database** set in `TEST_DATABASE_URL`. Never
   point it at a real database.
4. `pnpm test:e2e` for end-to-end tests, with the app running on a database with demo data.

On a computer with little memory, stop `pnpm dev` before the checks or tests, and run one big command at a time.

### On GitHub (CI)

Every pull request runs: types, lint, format, unused code, unit tests, the documents check, and the integration
tests with a real database. A red check blocks the merge. End-to-end tests can run on a schedule, or before a
release, if they are too slow for every pull request.

### Setting up Playwright (once, in the new repository)

Task 9C does this:

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
