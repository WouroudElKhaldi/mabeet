# Team plan

This file lists every task, in the order we build them, and how we use GitHub. It follows the functional and
non-functional requirements, the scope we locked with Sami (`docs/scope-lock.md`), and the demo-ready standard
(`docs/Ready for Business Demo-Ready Standard and Scope Lock.pdf`).

**Nobody is assigned yet.** We choose who takes each task in our meeting today (Friday 30 October, after the call
with Sami), and write the names in the `Owner` lines and in the overview table (section 4). After that, this file is
the only place that says who does what. Where an older file (`02`, `04`, `08`) still names a person, this file wins.

Read it with the other files in this folder:

- `02-architecture-and-features.md`: how each feature works, and how the code is built.
- `03-claude-prompt-guide.md`: how to ask Claude for work.
- `04-test-plan.md`: which tests to write, and how.
- `05-project-structure.md`: where each file goes.
- `06-functional-requirements.md`: what we build (F1, F2, ...). `docs/non-functional-requirements.md`: how well.
- `07-data-model.md`: the database. `08-design-system-and-pages.md`: every screen.

New words are explained in `README.md` (the glossary at the bottom).

---

## 1. Important dates

| Date                      | What happens                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Friday 30 October         | Call with Sami (scope locked). Team meeting: choose the owner of every task. Round 1 starts in the evening |
| Tuesday 3 November        | **Checkpoint 1.** The core flow works end to end on the public URL, on two phones, in English and Arabic   |
| Tuesday 10 November       | **Checkpoint 2.** Feature complete: every must-have, the AI checks and fallbacks, realistic data seeded    |
| Wednesday 11 to Friday 13 | No new features. Bugs, polish, documents, and the backup video                                             |
| Friday 13 November        | **Submission.** Polished and recorded                                                                      |
| 16 to 20 November         | Training week, if we are chosen as finalists                                                               |
| Saturday 21 November      | **Demo Day**, live on stage at Beirut Digital District, three minutes                                      |
| Every day                 | Standup in our Discord channel by 9:00 PM (Beirut time), one post per team, we take turns writing it       |

After the call with Sami, the scope is locked: adding a feature needs Sami's approval. Cutting is always allowed.

Standup format:

```
Team:
Status: Green / Amber / Red
Done today:
Next:
Blocked on:
```

Green: on time. Amber: we might be late and could use help. Red: we will be late without help. Saying Amber early is
good news; a surprise on 13 November is the only bad status.

### What "demo-ready" means for us (from Sami's document)

Every task below serves one of these seven points. When in doubt, the task that helps them more goes first.

1. One core flow works end to end, live, with no fake screens.
2. It runs on a public URL, with demo accounts already signed in on two phones.
3. Realistic Lebanese data: real-looking names, areas (Batroun, Deir el Qamar, Hamra, Jounieh, Ehden), USD prices,
   `+961` numbers. No "test", no lorem ipsum.
4. The AI is engineered, not wrapped: we can show where the model sits, what it decides, how its output is checked,
   and what happens when it is wrong or slow.
5. The business outcome is a number: the commission saved.
6. It can be told in three minutes.
7. A recorded backup video of the full demo.

---

## 2. How we split the work

### Three tasks at a time

The work is cut into **rounds**. Each round has exactly **three tasks, one for each of us**, built at the same time.
A round ends when its three tasks are merged into `main`; then the next round starts. So the three of us are always
working, and nobody waits for anybody.

The three tasks of a round are chosen so that:

- **they do not need each other.** Each one only needs tasks from earlier rounds, which are already merged. When a
  task must call something another task of the same round is building, the exact function is written in
  `02-architecture-and-features.md` (Part 14, the contracts): build everything else first, and connect that one call
  last, once the other pull request is merged. This happens in only a few places, and each one is written in the
  task's **Needs** line.
- **they do not touch the same files.** Each task lists the files it **owns**. Only that task creates or changes
  them during the round. Shared files are listed below.
- **they are close to each other.** The three tasks of a round are about the same part of the product (for example,
  booking: the engine, the owner's decisions and the guest's pages), so we can help each other and review each
  other's pull requests with the same picture in mind.

Task ids are the round number and a letter: `4A`, `4B`, `4C`. Slot A is mostly the engine and money, slot B mostly the
owner's side, slot C mostly the guest's side and the design. We may keep the same slot from round to round, so each
of us follows one part of the product, but we decide that in the meeting.

### One task, one person, from the database to the screen

Each task is built by **one person**, from start to end: the database queries, the business rules, the API routes,
the screens, the text in every language, and the tests. We all use Claude, and Claude can build a whole feature. We
never split one feature into a "backend person" and a "frontend person"; that only makes people wait.

### Shared files

These files are changed by many tasks. Add your lines in the part for your feature, keep the existing order, and pull
`main` every morning so conflicts stay small:

- `src/server/validation/schemas.ts` (the Zod input checks)
- `messages/en.json`, `messages/ar.json`, `messages/ar-LB.json` (one block per area, same keys in all three)
- `src/components/dashboard/nav-items.ts` (one line per dashboard page)
- `docs/openapi.json`: a route you add or change is written there, matching its Zod schema, then `pnpm docs` (which
  also writes `docs/openapi.yaml`). From task 11C, `scripts/openapi.ts` generates it from the schemas instead
- `knip.json`: the first task that imports a library removes it from `ignoreDependencies` (see section 3)

### The database keeper

`prisma/schema.prisma` and `prisma/migrations/` are already complete for every feature, including the bonus ones
(see Round 0). If a task still needs a database change, it goes through **one person**, the database keeper, chosen
in the meeting: write what you need in your pull request or on Discord, and it comes in its own small pull request
first. Never edit a merged migration; add a new one.

Database keeper: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### The pitch

**Fatima gives the pitch** on Demo Day and at each rehearsal. The three-minute story (task 10C) and the backup video
(task 11C) are prepared with her, whoever owns those tasks.

### Reviews

Every pull request is reviewed by one of the other two before it is merged. A review checks the code against
`02-architecture-and-features.md` and the checklist in its Part 13, not personal taste.

---

## 3. Round 0: the repository (done)

Already in the repository, so everyone starts from the same working project on Friday evening:

- Next.js 16 (App Router) with Tailwind 4, TypeScript in strict mode, pnpm, the `@/` path shortcut.
- Every library we will use, at the reference project's exact versions (`package.json`, `pnpm-lock.yaml`), plus
  Playwright for the browser tests and `yaml` for the API contract.
- ESLint with the two layer rules, Prettier (with Tailwind class order), knip, and Vitest with `unit` and
  `integration` projects.
- `prisma/schema.prisma` with **every table** (47), and the migrations that build it from an empty database:
  the reference project's migrations (with the database rules: the `occupancy_no_overlap` EXCLUDE constraint, the
  seat triggers, the CHECK rules), then `20261030000000_three_booking_modes`, which applies `07-data-model.md`
  (three booking modes, no refund policies, payments online only, no Kazderni).
- `docker-compose.yml`: **the whole project with nothing to install but Docker.** `docker compose up` starts
  Postgres, Redis, installs the libraries, creates every table (and the test database), and runs the website on
  http://localhost:3000, reloading when a file is saved. `docker-compose.prod.yml` is the production shape (the
  built image, the worker, Postgres, Redis), the `Dockerfile` builds that image, `scripts/local-db.ts`
  (`pnpm db:start`) runs Postgres without Docker, and `.env.example` explains every setting.
- The CI workflow (`.github/workflows/ci.yml`): types, lint, format, knip, unit tests, integration tests on a real
  Postgres, and generated documents up to date.
- The documents: `README.md`, `CLAUDE.md`, the Claude skills in `.claude/skills/`, `docs/` (requirements,
  architecture, data model, ERDs made from the schema, the API contract in JSON and YAML, the scope lock), and this
  folder.

What Round 0 does **not** have, on purpose: any feature code. Every line of the product is written in the tasks below.

**knip and the libraries.** Until a library is imported somewhere, knip would call it unused. So the libraries no
code uses yet are listed in `knip.json` under `ignoreDependencies`. The task that first imports one removes it from
that list in the same pull request. By Checkpoint 2 the list holds only the three permanent entries
(`eslint-config-next`, `eslint-config-prettier`, `tailwindcss`).

### Start here (each of us, Friday)

With Docker (nothing else to install):

```bash
git clone <repository url> tafaddal && cd tafaddal
docker compose up                      # first time: a few minutes. Then http://localhost:3000
docker compose exec app pnpm check     # must pass before every pull request
```

Without Docker (Node 22.12+ and pnpm):

```bash
pnpm install
cp .env.example .env        # then set the two secrets (see the comments)
pnpm db:start               # leave this terminal open
pnpm db:deploy              # creates every table
pnpm dev                    # http://localhost:3000
pnpm check                  # must pass before every pull request
```

---

## 4. Overview: every task in order

Fill the `Owner` column in the meeting. "Due" means merged into `main`.

| Round                              | Task                                                       | Requirements                    | Due                 | Owner |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------- | ------------------- | ----- |
| **1. Foundations**                 | 1A Server base and the sign-in engine                      | NFR security, maintainability   | Sat 31 Oct, 12:00   |       |
|                                    | 1B Design system and app frame                             | NFR design, F21                 | Sat 31 Oct, 12:00   |       |
|                                    | 1C Languages, value lists and permissions                  | F18, F13 (list), NFR least priv | Sat 31 Oct, 12:00   |       |
| **2. Accounts and places**         | 2A Tenancy and the dashboard frame                         | NFR business isolation          | Sun 1 Nov, 12:00    |       |
|                                    | 2B Sign in, accounts, creating a place, closing an account | F17                             | Sun 1 Nov, 12:00    |       |
|                                    | 2C Demo data and the public place page (read)              | F2 (basic), F3 (prices)         | Sun 1 Nov, 12:00    |       |
| **3. Booking engine and setup**    | 3A The booking engine with the three modes                 | F3, F9, NFR no double bookings  | Mon 2 Nov, 12:00    |       |
|                                    | 3B Rooms, prices and photos                                | F7                              | Mon 2 Nov, 12:00    |       |
|                                    | 3C Settings and the booking mode, and going live           | F9a, NFR quality                | Mon 2 Nov, 12:00    |       |
| **4. Money and decisions**         | 4A Online payments and full automatic refunds              | F4a, F4b, NFR money             | Tue 3 Nov, 12:00    |       |
|                                    | 4B The owner's bookings, decisions and closed dates        | F9, F11, NFR privacy            | Tue 3 Nov, 12:00    |       |
|                                    | 4C The guest's booking journey and "My trips"              | F3, F4                          | Tue 3 Nov, 12:00    |       |
| **Checkpoint 1**                   | Everyone: the core flow on two phones on the live URL      | Demo-ready 1, 2                 | Tue 3 Nov, evening  | all   |
| **5. Calendar and search**         | 5A Queues and the worker                                   | F14b (base), NFR reliability    | Wed 4 Nov           |       |
|                                    | 5B The calendar board                                      | F10 (board)                     | Wed 4 Nov           |       |
|                                    | 5C Search and the home page                                | F1                              | Wed 4 Nov           |       |
| **6. Sync, team, place page**      | 6A Calendar sync with Airbnb and Booking.com               | F10 (sync), must-work 3         | Thu 5 Nov           |       |
|                                    | 6B Team and roles                                          | F13                             | Thu 5 Nov           |       |
|                                    | 6C The full place page                                     | F2                              | Thu 5 Nov           |       |
| **7. Telling people**              | 7A Emails and the guest cancelling                         | F4 (emails), F4b, NFR reliab.   | Fri 6 Nov           |       |
|                                    | 7B The notification bell                                   | F14a                            | Fri 6 Nov           |       |
|                                    | 7C Contact the host and the host profile                   | F2a, F7a                        | Fri 6 Nov           |       |
| **8. The numbers**                 | 8A Payouts to owners                                       | F12a, F16a (payouts)            | Sat 7 Nov           |       |
|                                    | 8B Analytics and the commission saved                      | F12, must-work 4                | Sat 7 Nov           |       |
|                                    | 8C The demo story: months of realistic data                | Demo-ready 3                    | Sat 7 Nov           |       |
| **9. AI and finishing must-haves** | 9A The owner's AI assistant with the confirm card          | F14 (dashboard), must-work 5    | Mon 9 Nov           |       |
|                                    | 9B The whole place and "Your place"                        | F3 (whole place), F7            | Mon 9 Nov           |       |
|                                    | 9C Browser tests, calm states and Back buttons             | F21, demo-ready 1               | Mon 9 Nov           |       |
| **10. Demo-ready**                 | 10A Prove business isolation and roles everywhere          | NFR isolation, least privilege  | Tue 10 Nov          |       |
|                                    | 10B The AI on stage: scripted tests and fallbacks          | Demo-ready 4                    | Tue 10 Nov          |       |
|                                    | 10C The three-minute story and the demo accounts           | Demo-ready 2, 5, 6              | Tue 10 Nov          |       |
| **Checkpoint 2**                   | Everyone: the whole demo, twice, on the live URL           |                                 | Tue 10 Nov, evening | all   |
| **Bonus queue**                    | B1 to B11, taken in order by whoever is free (section 6)   | Part B of the requirements      | before Tue 10 Nov   |       |
| **11. Release**                    | 11A Bugs and the live site                                 |                                 | Fri 13 Nov          |       |
|                                    | 11B Polish the demo screens                                |                                 | Fri 13 Nov          |       |
|                                    | 11C Documents and the backup video                         | Demo-ready 7                    | Fri 13 Nov          |       |

**About the AI assistant.** For Sami, "the AI assistant and MCP" is a bonus (the scope's cut list says so). We
build the owner's assistant in the dashboard anyway, before Checkpoint 2, because we show it on stage (the scope's
core flow step 7 and "must work on stage" item 5): an order carried out after the owner confirms, a business
question answered with checked figures, and a clean fallback. So in this plan the **dashboard assistant is a
must-have (task 9A)**, scheduled after every other must-have so it never delays the core flow, and connecting
Claude, Cursor or Codex (MCP) stays a bonus (B4).

---

## 5. The tasks

Each task says:

- **Owner**: filled in the meeting.
- **When**: when it starts and when it is merged.
- **Requirements**: what it delivers (F = `06-functional-requirements.md`, NFR = `docs/non-functional-requirements.md`).
- **Needs**: the tasks it builds on (all merged in earlier rounds, unless written otherwise).
- **Owns**: the files only this task creates or changes during its round (besides the shared files of section 2).
- **Build, in this order**: what to build, step by step.
- **Gives the others**: the functions or screens later tasks call. Their exact shapes are in `02` Part 14.
- **Tests**: from `04-test-plan.md`.
- **Done when**: how we know it is finished.
- **Not in this task**: what belongs to another task, so nobody builds it twice.

The reference project (`se-next-stays`) has every one of these features built with exactly this structure. When a
task says "like the reference", open that file there and follow its style. Copying a file is allowed when the team
agrees, but it still goes through a normal pull request and review, and it must follow `07-data-model.md` (three modes,
full refunds, no Kazderni), not the reference's older rules.

---

### Round 1. Foundations

Friday 30 October evening → merged by Saturday 31 October, 12:00.

Why together: nobody can build a feature without the server base (1A), the screen pieces (1B) and the text and
permission lists (1C). None of the three needs the other two: 1A is server code, 1B is components and styles, 1C is
messages, value lists and the permission list.

#### 1A. Server base and the sign-in engine

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday evening → Saturday 12:00.
- **Requirements:** NFR security, maintainability, reliability; the engine under F17 (sign in).
- **Needs:** Round 0 only.
- **Owns:** `src/server/env.ts`, `src/server/errors.ts`, `src/server/db/client.ts`, `src/lib/money.ts`,
  `src/lib/dates.ts`, `src/lib/tokens.ts`, `src/server/http/route.ts`, `src/server/http/error-i18n.ts`,
  `src/server/http/rate-limit.ts`, `src/server/http/session.ts` (the session part), `src/server/background.ts`,
  `src/server/auth/better-auth.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/auth-client.ts`,
  `src/server/email/send.ts`, `tests/integration/global-setup.ts`, `tests/integration/setup-env.ts`,
  `vitest.config.mts`.
- **Build, in this order:**
  1. `env.ts`: every setting of `.env.example`, checked with Zod, with the `optional(...)` helper so an empty value
     counts as unset. Code reads `env.X`, never `process.env.X`.
  2. `errors.ts`: `notFound`, `forbidden`, `conflict`, `invalid`, `unavailable`, `unauthenticated`, each with a code
     and a message a guest or a host understands.
  3. `db/client.ts`: the Prisma client with the `moneyAsNumbers` extension (every `...Cents` column is `BigInt` in the
     database and a plain `number` in the code), the `Db` and `Tx` types, and `runInTransaction`.
     `lib/money.ts`: `MoneyAsNumbers<T>`, `moneyNumber()`, formatting in USD and LBP.
  4. `lib/dates.ts`: ISO nights, `DateRange { checkIn, checkOut }` (the check-out night is free), counting nights,
     overlap. `lib/tokens.ts`: booking references (`SN-7KX3P9`) and secret links.
  5. `http/route.ts`: `route(handler)`, `parseBody`, `parseQuery`, `parseParams`, `json`, and one error answer for
     every error code and for Zod failures. `http/error-i18n.ts`: error messages in the caller's language.
  6. `http/rate-limit.ts`: `enforceRateLimit(key, limit, windowMs)`, counting in Redis (`ioredis`, `REDIS_URL`) and in
     memory when `REDIS_URL` is empty or in tests. `background.ts`: `inBackground(label, work)`.
  7. Better Auth: `better-auth.ts` (email and password, email verification, password reset, the Prisma adapter on the
     existing `User`, `Session`, `Account`, `Verification` tables), the `/api/auth/[...all]` route, `auth-client.ts`
     with `signOutAndLeave`. `email/send.ts`: send with Resend, or print to the log when `RESEND_API_KEY` is empty;
     reserved test addresses (`.test`, `.example`) are never sent to.
  8. `http/session.ts`: `getSessionUser(request)` and `requireUser(request)` (401 when signed out).
  9. Tests setup: `global-setup.ts` (migrate the test database once), `setup-env.ts` (test database, no real email,
     jobs inline), and add both to the integration project in `vitest.config.mts`.
- **Gives the others:** everything above. Every later task uses `route`, `env`, the errors, `runInTransaction`,
  `requireUser` and `enforceRateLimit`.
- **Tests:** `tests/unit/dates.test.ts`, `tests/unit/send-email.test.ts`, `tests/unit/error-i18n.test.ts`,
  `tests/integration/rate-limit.test.ts` (20 requests at once against a limit of N: exactly N pass), and a
  money test that an LBP total above the 32-bit limit is read back exactly.
- **Done when:** `pnpm check` and `pnpm test:integration` pass; `/api/auth/sign-up/email` creates a user in the local
  database; removing `zod`, `ioredis` and `better-auth` from the `knip.json` ignore list still passes knip.
- **Not in this task:** the sign-in pages (2B), tenancy and `tenantRoute` (2A), the job queues (5A).

#### 1B. Design system and app frame

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday evening → Saturday 12:00.
- **Requirements:** NFR consistent design, accessibility, speed on phones; F21 (Back buttons).
- **Needs:** Round 0 only. The language menu item connects last, to 1C's `setLocale` (see "Needs" in 1C).
- **Owns:** `src/app/globals.css`, `src/app/fonts/*`, `src/components/ui/*`, `src/components/shell/*` (except
  `notification-bell.tsx` and `notification-list.tsx`, which are 7B's), `src/components/theme/*`,
  `src/components/site/*`, `src/components/brand/*`, `src/config/appearance.ts`, `src/config/brand.ts`,
  `src/hooks/*`, `src/lib/api-client.ts`, `src/lib/parent-path.ts`, `src/lib/motion.ts`, `src/app/not-found.tsx`,
  `src/app/error.tsx`, `src/app/offline/page.tsx`, `src/app/(site)/layout.tsx`.
- **Build, in this order:** (we do **not** design a new look: it is exactly the reference project's, as written in
  `08-design-system-and-pages.md`)
  1. `globals.css`: every colour token, the five palettes in light and dark mode, the status colours, radii,
     shadows, motion, the four fonts (self-hosted in `src/app/fonts/`), the text sizes (`08` Parts 2 to 4).
  2. The basics everyone needs first, merged in their own small pull request by Saturday morning: `Button`,
     `ButtonLink`, `Field`, `FormError`, `PageHeader`, `Panel`, `inputClass`, `panelClass`.
  3. Then `TextArea`, `LabeledControl`, `SheetDialog`, `useConfirm` (`confirm-dialog.tsx`), `Skeleton`,
     `LoadingStatus`, `choiceChipClass`, `DateRangePicker`, `GuestCounter`, `CopyField`, `Rating`, `ShowAllDialog`.
  4. The app frame: `AppShell` (side menu, top bar, phone tab bar), `BackLink` with `parent-path.ts` (every page goes
     back to the page it belongs to, also after a refresh or from a shared link), skeletons, pagination.
  5. The public frame: `SiteHeader`, `SiteFooter`, `Wordmark`, and the `(site)` layout.
  6. The light/dark switch and palette (`appearance-provider`, `appearance-script`, `appearance-menu`).
  7. `api-client.ts` (`api.get/post/patch/delete`, `errorMessage(caught, fallback)`) and the hooks `useAction`,
     `useRedirectAction`, `useStoredChoice`.
  8. The not found, error and offline pages.
- **Gives the others:** every screen is built from these pieces. The `AppShell` takes its menu from
  `nav-items.ts` (2A creates it; each dashboard task adds its line).
- **Tests:** `tests/unit/parent-path.test.ts`.
- **Done when:** the not found page and the `(site)` frame work in light and dark, in English and Arabic, at 390 pixels
  wide with no sideways scrolling, using tokens only, and look the same as the reference project.
- **Not in this task:** any page with data, the notification bell (7B).

#### 1C. Languages, value lists and permissions

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday evening → Saturday 12:00.
- **Requirements:** F18 (English, Arabic, Lebanese Arabic, right-to-left), the permission list behind F13 and NFR
  least privilege, NFR maintainability (lists of values live once).
- **Needs:** Round 0 only. 1B's language menu calls `setLocale` from this task: merge the languages part first
  (Saturday morning), so 1B connects it.
- **Owns:** `src/i18n/request.ts`, `messages/en.json`, `messages/ar.json`, `messages/ar-LB.json`,
  `src/app/actions/locale.ts`, `src/app/layout.tsx`, `next.config.ts` (the next-intl plugin), `src/config/enums.ts`,
  `src/config/listing.ts`, `src/config/amenities.ts`, `src/config/regions.ts`, `src/config/plans.ts`,
  `src/config/category-icons.ts`, `src/server/auth/permissions.ts`, `src/lib/format.ts`, `src/lib/zoned-time.ts`.
- **Build, in this order:**
  1. next-intl: `i18n/request.ts` (the language from the person's choice, then the browser), the plugin in
     `next.config.ts`, the root `layout.tsx` with `lang` and `dir="rtl"` for Arabic, and `setLocale` (a server action
     that saves the choice, and `User.locale` when signed in).
  2. The three message files with the shared texts (buttons, errors, the frame). Lebanese Arabic is spoken style.
  3. `lib/format.ts` (dates, nights, money in the person's language) and `lib/zoned-time.ts` (Beirut time).
  4. `config/enums.ts`: every list of values the screens and services use (booking statuses, the **three booking
     modes**, payment methods for bookings (`WHISH`, `STRIPE`), feed sources (`AIRBNB`, `BOOKING`, `OTHER`), payout
     methods, plans), each checked with `satisfies` against the Prisma enum. `listing.ts` (tags, accessibility),
     `amenities.ts` (the jacuzzi included), `regions.ts` (each region's towns and spellings), `plans.ts` (limits).
  5. `permissions.ts`: the `Permission` list (`rooms.read`, `rooms.manage`, `bookings.read`, `bookings.decide`,
     `guests.contact`, `calendar.manage`, `analytics.read`, `settings.manage`, `team.manage`, `payouts.manage`,
     `ai.use`, ... the full list in `02` Part 5), `ALL_PERMISSIONS`, `DEFAULT_ROLE_TEMPLATES` (Manager, Front desk,
     Housekeeping), read-only filtering, and "nobody can give what they do not have".
- **Gives the others:** `useTranslations`, the value lists, and `Permission` / `DEFAULT_ROLE_TEMPLATES` (2A, 2B and 2C
  need them on Saturday).
- **Tests:** `tests/unit/messages.test.ts` (every English key is in both Arabic files, nothing extra, nothing empty),
  `tests/unit/locale.test.ts`, `tests/unit/permissions.test.ts`, `tests/unit/regions.test.ts`,
  `tests/unit/zoned-time.test.ts`.
- **Done when:** switching to Arabic turns the page right-to-left and stays after a refresh; `pnpm check` passes.
- **Not in this task:** roles in the database and the team page (6B), tenancy (2A).

---

### Round 2. Accounts and places

Saturday 31 October, 12:00 → merged by Sunday 1 November, 12:00.

Why together: after this round a person can sign up, create a place and open its dashboard, and a guest can open a
place's page with real rooms and prices. 2A is the business check every owner screen needs, 2B is the person, 2C is
the place. 2B and 2C only use 1A to 1C; 2B's "Create your place" sends the owner to the dashboard, whose frame is 2A's.

#### 2A. Tenancy and the dashboard frame

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday 12:00 → Sunday 12:00.
- **Requirements:** NFR business isolation, least privilege.
- **Needs:** 1A (session, route), 1B (`AppShell`), 1C (permissions).
- **Owns:** `src/server/auth/tenant-context.ts`, `src/server/services/team-service.ts` (`resolveContext` only; 6B adds
  the rest), `src/server/repositories/team-repository.ts` (membership lookup only), `src/server/http/session.ts`
  (`requirePageTenant`, `requirePageAccess`), `src/server/http/page.ts`, `src/server/services/audit.ts`,
  `src/server/repositories/activity-repository.ts`, `src/app/dashboard/[businessId]/layout.tsx`,
  `src/app/dashboard/[businessId]/page.tsx` (an empty overview: 8B fills it), `src/components/dashboard/nav-items.ts`,
  `tests/integration/helpers.ts`, `tests/integration/http.ts`.
- **Build, in this order:**
  1. `TenantContext` (who, which business, which permissions, owner or not, platform admin or not), `can`,
     `requirePermission`, `requireOwner`.
  2. `resolveContext(userId, businessId)`: the membership and its role, or `null` (never a hint that the business
     exists).
  3. `tenantRoute(paramsSchema, handler)` for every `/api/workspaces/[businessId]/**` route: 401 signed out, 404 not
     a member.
  4. `requirePageTenant`, `requirePageAccess` for pages (the 404 page if not a member).
  5. `recordAction` (the audit log) and the activity log write used by the bell later.
  6. The dashboard layout with the `AppShell` and `nav-items.ts`, and the empty overview page.
  7. The test helpers everyone uses: create a business with an owner and staff, sign in over HTTP, call a route.
- **Gives the others:** the tenancy contract in `02` Part 14. Every owner task from Round 3 on uses it.
- **Tests:** a first `tests/integration/tenant-isolation.test.ts` (a member is let in; a non-member gets 404 with a
  real id; staff without a permission get 403).
- **Done when:** the test passes and the dashboard frame opens for the owner of a seeded business.
- **Not in this task:** members, invitations and roles screens (6B).

#### 2B. Sign in, accounts, creating a place, closing an account

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday 12:00 → Sunday 12:00.
- **Requirements:** F17 (all of it).
- **Needs:** 1A (Better Auth, email sending), 1B (components), 1C (messages, `DEFAULT_ROLE_TEMPLATES`). "Create your
  place" sends the owner to `/dashboard/{businessId}`, whose frame is 2A's: until 2A merges it shows Next's 404, which
  is fine.
- **Owns:** `src/app/(auth)/**` (sign in, sign up, forgot and reset password, the layout),
  `src/components/account/auth-form.tsx`, `auth-page.tsx`, `password-forms.tsx`, `sign-out-button.tsx`,
  `create-workspace-form.tsx`, `privacy-controls.tsx`, `src/app/home/page.tsx`, `src/app/dashboard/page.tsx`,
  `src/server/services/onboarding-service.ts`, `src/server/repositories/business-repository.ts` (create and lookups),
  `src/server/services/account-service.ts`, `src/server/repositories/account-repository.ts`,
  `src/app/api/workspaces/route.ts`, `src/app/api/me/delete/route.ts`, `src/app/api/me/export/route.ts`,
  `src/app/(site)/account/privacy/page.tsx`, `src/lib/privacy.ts`.
- **Build, in this order:**
  1. Sign in, sign up (with email verification), forgot and reset password, sign out, each returning to the page the
     person came from (`?next=`), on a phone, in English and Arabic.
  2. `/home`: owners go to their dashboard, guests to the home page. `/dashboard`: the list of my places, or straight
     into the only one.
  3. Creating a place: `createWorkspace` makes the business, the owner role (every permission, cannot be changed) and
     the default roles together, in one transaction. `POST /api/workspaces` and the "Create your place" screen.
  4. Closing an account: the person types their email; they are signed out everywhere and cannot sign in again, the
     email is free for a new account, their favourites, chats and team access go away; their bookings and reviews
     stay with the host, the reviews without their name. "Download my data" (`/api/me/export`).
- **Gives the others:** the auth pages that booking (4C) sends signed-out guests to; `createWorkspace` (the seed uses
  it).
- **Tests:** `tests/unit/privacy.test.ts`; an integration test for creating a place (owner role has every permission,
  default roles exist) and for deleting an account (signed out, email free, bookings kept).
- **Done when:** a person signs up, creates a place, becomes its owner, signs out and in again, and deletes a second
  test account, from a phone, in English and Arabic.
- **Not in this task:** the guest's trips page (4C), the host profile (7C).

#### 2C. Demo data and the public place page (read)

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday 12:00 → Sunday 12:00.
- **Requirements:** F2 (the basic place page), the price and taken nights behind F3, demo-ready 3.
- **Needs:** 1A, 1B, 1C.
- **Owns:** `prisma/seed.ts`, `package.json` (`db:seed` and the `prisma.seed` entry),
  `src/server/repositories/directory-repository.ts`, `src/server/services/directory-service.ts`,
  `src/server/services/pricing.ts`, `src/app/(site)/p/[slug]/page.tsx` (the simple version; 6C makes it full),
  `src/app/api/public/places/[slug]/rooms/[roomId]/quote/route.ts`,
  `src/app/api/public/places/[slug]/rooms/[roomId]/availability/route.ts`, `src/components/booking/booking-widget.tsx`,
  `src/components/booking/use-room-calendar.ts`, `src/components/booking/price-breakdown.tsx`,
  `src/lib/calendar-grid.ts`, `src/lib/slug.ts`.
- **Build, in this order:**
  1. The seed, realistic from the first day: one guesthouse in **each booking mode** (for example Dar Al Sindiyan in
     Deir el Qamar in online with approval, Beit Batroun in automatic, Ehden Stone House in offline), an owner, a
     front desk staff member, a guest, a platform admin, rooms with USD prices and a few special prices, bookings in
     every status, one Airbnb stay (an `IMPORTED` occupancy from a `CalendarFeed`), one closed date. Lebanese names,
     `+961` numbers. It can run twice without making copies. Demo password from `SEED_PASSWORD`.
  2. `pricing.ts`: the total is the sum of each night's price; a special price replaces the base price on its night.
  3. `getPlace`, `quoteRoom`, `getTakenNights` (direct, closed and imported nights), `checkAvailability`.
  4. The quote and availability routes (rate limited).
  5. A simple place page: name, area, photos, rooms with their price, and the booking box (`booking-widget.tsx`):
     pick dates, taken nights greyed out and impossible to choose, the price per night and the total. Its "Book"
     button links to `/p/[slug]/book?room=…&checkIn=…&checkOut=…` (4C builds that page).
- **Gives the others:** demo data for every screen, `pricing.ts` for the booking engine (3A), `getTakenNights` for the
  calendar (5B).
- **Tests:** `tests/unit/pricing.test.ts`; an integration test that a taken night is refused by `checkAvailability`.
- **Done when:** `pnpm db:seed` works on an empty database (twice), and a guest sees prices and taken nights for each
  demo place on a phone.
- **Not in this task:** the book page and booking itself (3A, 4C), search (5C), the full place page (6C), months of
  history (8C).

---

### Round 3. Booking engine and setup

Sunday 1 November, 12:00 → merged by Monday 2 November, 12:00.

Why together: everything a booking depends on. 3A is the engine, 3B is what is for rent (rooms, prices,
photos), 3C is how the place wants to be booked (the mode) and the live site that Checkpoint 1 needs.

#### 3A. The booking engine with the three modes

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday 12:00 → Monday 12:00.
- **Requirements:** F3, F9 (the rules), NFR no double bookings. Must work on stage 2.
- **Needs:** 2A (tenancy), 2C (pricing, demo data).
- **Owns:** `src/server/services/booking-policy.ts`, `booking-status.ts`, `constraint-errors.ts`,
  `booking-service.ts`, `housekeeping-service.ts`, `src/server/repositories/booking-repository.ts`,
  `src/app/api/cron/expire-holds/route.ts`.
- **Build, in this order:**
  1. `booking-policy.ts`: where a booking starts in each mode (`AUTOMATIC` and `ONLINE_APPROVAL` start as
     `AWAITING_PAYMENT` with a 10-minute payment window; `OFFLINE` starts as `HELD` with the owner's answer time,
     `holdHours`), copied to `Booking.bookingMode`.
  2. `booking-status.ts`: the allowed status changes in `07-data-model.md`, section 2.4, and nothing else.
  3. `constraint-errors.ts`: `overlapAsConflict` (the database's `23P01`) and `duplicateAsConflict` (`P2002`).
  4. `booking-repository.ts`: `lockActiveRoom` (row lock), saving a booking and its `DIRECT` occupancy together.
  5. `requestBooking`: lock the room, expire old holds on it, refuse nights taken on Airbnb or Booking.com, price it
     with `pricing.ts`, save the booking and its nights together, turn the database's refusal into a 409 "Those
     dates were just taken".
  6. `confirmBooking`, `declineBooking`, `cancelBooking` (need `bookings.decide`), `cancelStayAsGuest`,
     `getBookingForGuest`. A decline, a cancel or an expiry of a booking paid online calls the refund function of 4A
     through its contract (`refundForEndedBooking`); until 4A merges, that call is the one line left to connect.
  7. `expireHolds` in `housekeeping-service.ts` (unpaid after 10 minutes, unanswered after `holdHours`) and
     `POST /api/cron/expire-holds` (needs `CRON_SECRET`), so it can run every 5 minutes before the worker exists.
- **Gives the others:** the booking engine contract in `02` Part 14 (4A, 4B, 4C, 3B's closed dates).
- **Tests:** `tests/unit/booking-policy.test.ts`, `tests/unit/booking-status.test.ts`,
  `tests/integration/booking-flow.test.ts` (each of the three modes), `tests/integration/booking-race.test.ts`
  (20 requests at once: 1 wins, 19 get "dates taken", 1 stay stored), `tests/integration/occupancy-constraint.test.ts`.
- **Done when:** those tests pass for all three modes.
- **Not in this task:** payments (4A), the screens (4B, 4C), the whole place (9B), clash flags (6A adds
  `recheckImportClashes` and the calls to it).

#### 3B. Rooms, prices and photos

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday 12:00 → Monday 12:00.
- **Requirements:** F7 (rooms, prices and photos). Step 1 of the core flow: the owner adds their guesthouse with
  rooms, prices and photos.
- **Needs:** 2A. Photos go to Cloudflare R2 once 3C has set up the bucket; until then, and always on our computers
  and in tests, they are kept in Postgres, so nothing waits for 3C.
- **Owns:** `src/server/repositories/room-repository.ts`, `src/server/services/room-service.ts`,
  `src/app/api/workspaces/[businessId]/rooms/**`, `src/app/dashboard/[businessId]/rooms/**`,
  `src/components/dashboard/room-editor.tsx`, `special-prices.tsx`, `photo-manager.tsx`,
  `src/server/services/photo-service.ts`, `src/server/repositories/photo-repository.ts`,
  `src/app/api/workspaces/[businessId]/photos/**`, `src/app/api/images/[imageId]/route.ts`,
  `src/app/dashboard/[businessId]/place/page.tsx` (the place's photos only; 9B adds the rest of "Your place").
- **Build, in this order:**
  1. Rooms: list, add, edit (name, kind, guests, beds, bedrooms, bathrooms, amenities, base price), soft delete; the
     plan's room limit; `findRoomByNameOrId` (the AI uses it later). Needs `rooms.manage`.
  2. Special prices for given nights (`RateOverride`, upsert on room and date, at most 366 nights).
  3. Photos: upload JPEG, PNG or WebP up to 2.5 MB (the type comes from the file's own bytes, not its name), shrunk on
     our server with `sharp` to at most 1600 pixels wide and turned into WebP; stored in Cloudflare R2 on the live
     site (uploaded with `aws4fetch`, served from `R2_PUBLIC_URL`, free tier) and in Postgres
     (`StoredImage.bytes`, served from `/api/images/{id}`) when the R2 settings are empty. Ordered, with alt
     text; room photos on each room, and the place's own photos grouped by area. Removing a photo marks it deleted.
     See `02` "P. Photos".
  4. The rooms page: each room in `room-editor.tsx` with `photo-manager.tsx` and `special-prices.tsx`, and
     "Add a room"; the place's photos page with the same `photo-manager.tsx`. Phone first.
  5. The guest's place page (2C) shows the uploaded photos: `getPlace` already returns each `Photo.url`.
- **Gives the others:** rooms and photos for every screen, `photo-manager.tsx` for "Your place" (9B) and
  experiences (B2).
- **Tests:** `tests/integration/rooms.test.ts`, the prices part of `tests/integration/reviews-and-prices.test.ts`,
  `tests/unit/photos.test.ts` (a file that is not an image is refused whatever its name; a big photo is shrunk;
  without R2 settings the bytes are kept in Postgres).
- **Done when:** an owner adds a room with its price and photos, and the place's photos, from a phone, and the guest
  sees them on the place page; the live site stores them in R2.
- **Not in this task:** closed dates (4B), the place's other details and the whole place (9B), the calendar board
  (5B).

#### 3C. Settings and the booking mode, and going live

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday 12:00 → Monday 12:00.
- **Requirements:** F9a (choosing the mode), NFR quality (deploy only after every check), demo-ready 2 (public URL).
- **Needs:** 2A, 2C (demo data for the live site).
- **Owns:** `src/server/services/settings-service.ts`, `src/app/api/workspaces/[businessId]/settings/route.ts`,
  `src/app/dashboard/[businessId]/settings/**`, `src/components/dashboard/settings-form.tsx`,
  `.github/workflows/ci.yml` (the deploy job), `.github/workflows/scheduled-jobs.yml`, `Dockerfile`,
  `docker-compose.prod.yml`.
- **Build, in this order:**
  1. Settings: contact (phone, WhatsApp), currency, LBP rate, commission rate, the owner's answer time (`holdHours`),
     check-in and check-out times, payment instructions (offline mode), and **the booking mode**: automatic, online
     with approval, or offline.
  2. Choosing an online mode asks the owner to accept "online payments are always refunded in full" and saves
     `onlineTermsAcceptedAt`. The service refuses an online mode without it.
  3. Going live on DigitalOcean with Docker: the managed Postgres, a Redis beside the website (never published),
     the image built from the `Dockerfile`, the migrations run before the website starts, the live settings in
     DigitalOcean (never in the repository), the demo data with a private `SEED_PASSWORD`. The Cloudflare R2 bucket
     for photos (free tier): a public bucket on a custom domain (not the rate-limited `r2.dev` address), an API token
     with read and write on that bucket only, and the five `R2_*` settings on the live site.
  4. The deploy job in GitHub Actions, only after every check passes, and protection on `main` (pull requests only,
     one approval, green checks).
  5. `scheduled-jobs.yml`: calls `/api/cron/expire-holds` every 5 minutes on the live site (until 5A's worker runs
     it), with the `APP_URL` and `CRON_SECRET` secrets.
- **Gives the others:** the live URL. From Monday, every merge to `main` shows up on it.
- **Tests:** an integration test that the next booking follows the new mode, and that an online mode is refused
  without the terms.
- **Done when:** changing the mode changes how the next booking works; a merge to `main` shows up on the public URL;
  the scheduled job runs.
- **Not in this task:** payments (4A), the worker (5A).

---

### Round 4. Money and decisions

Monday 2 November, 12:00 → merged by Tuesday 3 November, 12:00. Checkpoint 1 is Tuesday evening.

Why together: the core flow itself. 4C is the guest booking and following the booking, 4A is the guest paying and
being refunded, 4B is the owner deciding. All three call the engine (3A), which is merged. The pay buttons (4A) go on
the guest's booking page (4C): 4C builds the page with a place for them, and 4A's pull request adds `PayOnline` to it
after 4C merges.

#### 4A. Online payments and full automatic refunds

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Monday 12:00 → Tuesday 12:00.
- **Requirements:** F4a, F4b, NFR money is never doubled, no commission, card safety. Must work on stage 1.
- **Needs:** 3A. The buttons connect to 4C's `/b/[token]` page once it merges. Step 5 adds one call each to 3A's
  `declineBooking`, `cancelBooking` and `expireHolds`; 4B adds its list functions to the same file in their own
  section, so the two pull requests do not touch the same lines.
- **Owns:** `src/server/payments/whish.ts`, `src/server/billing/stripe.ts`,
  `src/server/repositories/money-repository.ts`, `payment-repository.ts`, `whish-simulator-repository.ts`,
  `src/server/services/online-payment-service.ts`, `payment-service.ts`, `whish-simulator-service.ts`,
  `src/app/api/public/bookings/[token]/checkout/route.ts`, `src/app/api/payments/whish/callback/route.ts`,
  `src/app/api/webhooks/stripe/route.ts`, `src/app/api/whish-simulator/**`, `src/app/(site)/whish-simulator/**`,
  `src/components/payments/whish-simulator-form.tsx`, `src/components/booking/pay-online.tsx`.
- **Build, in this order:**
  1. The Whish client with its simulator: a permanent mode (`WHISH_MODE=simulator`) that follows Whish's real API
     (version 1.4.4), with its own payment page (test phone `96170123456`, code `111111`), so real Whish needs only
     the keys. The Stripe client in test mode (Checkout; the card is typed on Stripe's page, never ours).
  2. `startBookingCheckout`: always the booking's full `totalCents`, only for `AUTOMATIC` and `ONLINE_APPROVAL`
     bookings that are `AWAITING_PAYMENT`.
  3. `settleOnlinePayment`: asks Whish or Stripe what happened (a callback proves nothing), marks the payment paid
     once (`PENDING → PAID`, the gate), then mode 1 → `CONFIRMED`, mode 2 → `HELD` waiting for the owner. A payment
     for a booking that already ended is refunded in full.
  4. The Whish callback and the Stripe webhook (signature checked; each event applied once with `WebhookEvent`).
  5. `refundForEndedBooking`: always the full amount, through Whish or Stripe; a provider error records a `PENDING`
     refund for an admin to send by hand. Connect it in 3A's decline, cancel and expiry.
  6. `PayOnline` (Whish and card buttons) on the guest's booking page.
- **Gives the others:** paid bookings for the owner's list (4B), the payout balance (8A), the money emails (7A).
- **Tests:** `tests/unit/whish.test.ts`, `tests/integration/money.test.ts` (10 callbacks at once → 1 confirmation;
  mode 1 confirms, mode 2 waits; unpaid after 10 minutes → cancelled and the nights free; every cancellation of a paid
  booking is refunded in full).
- **Done when:** those tests pass, and a guest pays with the Whish simulator and with a Stripe test card on a phone.
- **Not in this task:** payouts (8A), plans (B1).

#### 4B. The owner's bookings, decisions and closed dates

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Monday 12:00 → Tuesday 12:00.
- **Requirements:** F9, F11 (closing dates by hand), NFR privacy (staff without `guests.contact` see hidden contacts).
- **Needs:** 2A, 3A, 3B.
- **Owns:** the list and read part of `booking-service.ts` (`listBookings`, `getBooking`, `getBookingByReference`,
  `presentForStaff`; 3A owns the rest of the file, so add them in their own section),
  `src/app/api/workspaces/[businessId]/bookings/**`, `src/app/dashboard/[businessId]/bookings/**`,
  `src/components/dashboard/booking-row.tsx`, `booking-actions.tsx`, `src/components/booking/hold-countdown.tsx`,
  `src/components/dashboard/close-dates-form.tsx`, the blocks part of `src/server/services/calendar-service.ts` and
  `src/server/repositories/calendar-repository.ts` (`addBlock`, `removeBlock`),
  `src/app/api/workspaces/[businessId]/blocks/**`.
- **Build, in this order:**
  1. The bookings list: waiting bookings first, then upcoming, then past; filters by status and room; each row shows
     the guest, the room, the nights, the total, the mode, whether it is paid, and the countdown to the payment window
     or the owner's answer time.
  2. A booking's details page.
  3. `booking-actions.tsx`: Confirm and Decline (modes 2 and 3, when `HELD`), Cancel (every mode, when `CONFIRMED`),
     each with an "are you sure?" step (`useConfirm`), calling `confirmBooking`, `declineBooking`, `cancelBooking`.
     A decline or cancel of a paid booking says the guest is refunded in full.
  4. `POST .../bookings/[bookingId]/[action]`.
  5. Closed dates: `addBlock` (a `MANUAL` occupancy with a note, in `runInTransaction` with `lockActiveRoom`,
     refused with `overlapAsConflict` if the nights are taken) and `removeBlock`, their routes, and
     `close-dates-form.tsx` on each room (shown on 3B's rooms page with one line there, announced on Discord).
     Needs `calendar.manage`.
- **Gives the others:** the screen the owner uses on stage (step 5 of the core flow); `addBlock` and `removeBlock`
  for the calendar board (5B) and the AI's "close the Arched room from 12 to 15 November" (9A).
- **Tests:** `tests/integration/booking-actions.test.ts` (each action through the route; 403 without
  `bookings.decide`; hidden contacts for staff without `guests.contact`), the blocks part of
  `tests/integration/calendar.test.ts`.
- **Done when:** the tests pass, and an owner confirms, declines and cancels, and closes and reopens dates, from a
  phone; the guest's booking box shows closed nights as taken.
- **Not in this task:** the notification that a request arrived (7A, 7B), the calendar board (5B).

#### 4C. The guest's booking journey and "My trips"

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Monday 12:00 → Tuesday 12:00.
- **Requirements:** F3 (booking needs an account, coming back to the chosen dates), F4 (following the booking).
- **Needs:** 2B (sign-in pages), 2C (booking box), 3A (`requestBooking`, `getBookingForGuest`).
- **Owns:** `src/app/(site)/p/[slug]/book/page.tsx`, `src/components/booking/guest-details-form.tsx`,
  `src/app/api/public/places/[slug]/bookings/route.ts`, `src/app/api/public/bookings/[token]/route.ts`,
  `src/app/(site)/b/[token]/page.tsx`, `src/app/(site)/account/layout.tsx`, `src/app/(site)/account/page.tsx`,
  `src/components/account/account-tabs.tsx`, `src/app/api/me/bookings/route.ts`.
- **Build, in this order:**
  1. The book page: the chosen room, nights and total, the guest's name, phone (`+961…`) and note, and what happens
     next in this place's mode ("You pay now and it is confirmed at once", "You pay now, then the host confirms",
     "The host confirms, then you arrange payment with them"). A signed-out guest is sent to sign in or sign up and
     comes straight back with the same dates.
  2. The booking route: `requireUser`, the input check, the rate limit, `requestBooking`. "Those dates were just
     taken" is shown calmly next to the dates.
  3. The booking page `/b/[token]`: opens only for the guest who made it (anyone else: not found); its status in
     plain words, the countdown, what to pay (online modes, the full total), the host's payment instructions
     (offline), a WhatsApp button to the place's number, and the space where 4A's `PayOnline` goes.
  4. "My trips" in the account: every booking with its status and a link to its page.
- **Gives the others:** the guest's half of the core flow.
- **Tests:** an integration test that a booking link opens only for its guest (and not found for another account).
- **Done when:** a guest books from the place page to the booking page on a phone, in English and Arabic, a taken night
  cannot be chosen, and wrong input shows a calm message next to the field.
- **Not in this task:** paying (4A), the guest cancelling (7A), emails (7A).

#### Checkpoint 1 (Tuesday 3 November, afternoon and evening): everyone

On the public URL, on two phones (the guest's and the owner's, both signed in), in English and Arabic, run steps 1 to 6
of the core flow in `docs/scope-lock.md` three times: once in each booking mode. Step 1 is the owner creating a
guesthouse with rooms, prices and photos (2B, 3B, 3C). Write every problem on Discord; each
of us fixes the ones in our own tasks. Then post the Checkpoint 1 standup.

---

### Round 5. Calendar and search

Wednesday 4 November.

Why together: the second half of the guest's and the owner's views of the nights. 5A is the background engine the
calendar sync (6A), the emails (7A) and the AI (9A) need, 5B shows every taken night to the owner, 5C helps the guest
find a free place.

#### 5A. Queues and the worker

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Wednesday.
- **Requirements:** NFR reliability and responsiveness under load; the base of F14b.
- **Needs:** 1A, 3A (`expireHolds`).
- **Owns:** `src/server/jobs/*` (`queue.ts`, `registry.ts`, `worker.ts`, `cron-jobs.ts`, `progress.ts`),
  `src/server/repositories/job-progress-repository.ts`, `src/app/api/jobs/[jobId]/route.ts`, `scripts/dev.ts`,
  `package.json` (`dev`, `dev:web`, `worker`), `docker-compose.prod.yml` (removes the worker's profile), and
  `docker-compose.yml` (adds a `worker` service and sets `JOBS_MODE: queue`).
- **Build, in this order:**
  1. `queue.ts` with pg-boss in a `pgboss` schema in our own Postgres: `defineJob(queue, kind, handler)`, `runOrQueue`,
     `findJob`, `jobResponse`, the three queues `ai` (4 at once per worker), `notify` (retried up to 4 times) and
     `cron`. Job data holds only ids and plain values.
  2. `registry.ts` and the worker (`pnpm worker`), which finishes jobs in flight on a deploy (60 seconds).
  3. `cron-jobs.ts`: housekeeping (`expireHolds`) every 5 minutes. 6A adds calendar sync every 15 minutes.
  4. `GET /api/jobs/[jobId]` and `JobProgress` (the answer while it is written), and `api.run` in the browser
     (follows a queued job until it is done).
  5. `pnpm dev` starts the website and the worker together (`[web]` and `[worker]` lines); `pnpm dev:web` the
     website alone. The worker runs on DigitalOcean beside the website, from the same image. Remove the
     `schedule:` lines from `scheduled-jobs.yml` (keep it as a manual run).
- **Gives the others:** `defineJob` for emails and push (7A), sync (6A) and the AI (9A).
- **Tests:** `tests/unit/jobs.test.ts`, `tests/unit/background.test.ts`.
- **Done when:** the live worker's log shows housekeeping running every 5 minutes, and a test job runs through it.
- **Not in this task:** the AI jobs (9A), the email jobs (7A).

#### 5B. The calendar board

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Wednesday.
- **Requirements:** F10 (the one view).
- **Needs:** 4B (blocks), 2C (`getTakenNights`). The demo data has an Airbnb stay, so imported nights show before
  6A.
- **Owns:** `getCalendarBoard` in `calendar-service.ts` and `calendar-repository.ts` (in its own section),
  `src/app/api/workspaces/[businessId]/calendar/route.ts`, `src/app/dashboard/[businessId]/calendar/**`,
  `src/components/dashboard/calendar-board.tsx`, `calendar-side-panel.tsx`, `calendar-model.ts`,
  `channel-colors.ts`.
- **Build, in this order:** the month view first (every room, direct bookings, closed dates, Airbnb and Booking.com
  nights, each in its channel colour), then the week view, then the rooms view; a panel for the chosen day (who
  arrives, who leaves, what is closed, with links to the booking); closing dates from the panel with 4B's form. A clash
  (an imported stay with `conflict = true`) has a red outline. No drag and drop.
- **Tests:** the board part of `tests/integration/calendar.test.ts`.
- **Done when:** an owner sees every taken night of the demo data in the three views on a phone, and closes dates from
  the day panel.
- **Not in this task:** syncing feeds (6A).

#### 5C. Search and the home page

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Wednesday.
- **Requirements:** F1.
- **Needs:** 2C.
- **Owns:** `searchPlaces` in `directory-service.ts` and `directory-repository.ts` (in its own section),
  `src/server/repositories/filters.ts`, `src/app/(site)/page.tsx`, `src/app/(site)/search/page.tsx`,
  `src/components/browse/*`, `src/components/place/place-card.tsx`, `place-grid.tsx`, `category-icon.tsx`,
  `src/components/site/search-bar.tsx`, `hero-landscape.tsx`, `src/lib/search-url.ts`.
- **Build, in this order:** search by dates (only places really free on those nights), guests, area or region,
  category, price, amenities, tags and accessibility; the home page with the search bar, categories and place cards;
  the filters dialog (a full-screen sheet on a phone); the search state in the URL so a search can be shared.
- **Tests:** an integration test that a place taken on the chosen nights is not shown, and the region search
  ("North Lebanon", "الشمال") part of `tests/integration/place-search.test.ts`.
- **Done when:** a guest finds a free place for given dates from the home page on a phone, in English and Arabic.
- **Not in this task:** the travel assistant (B3), experiences in search (B2).

---

### Round 6. Sync, team, place page

Thursday 5 November.

Why together: each finishes what Round 5 started. 6A fills the board (5B) with Airbnb and Booking.com through the
worker (5A), 6B gives the owner a team for the dashboard, 6C turns the simple place page into the full one that the
search (5C) leads to.

#### 6A. Calendar sync with Airbnb and Booking.com

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Thursday.
- **Requirements:** F10 (sync), must work on stage 3.
- **Needs:** 5A (the cron queue), 3A, 4B.
- **Owns:** `src/server/ical/*` (`safe-fetch.ts`, `parse-feed.ts`, `build-feed.ts`), the sync part of
  `calendar-service.ts` and `calendar-repository.ts` (in its own section), `src/app/api/workspaces/[businessId]/feeds/**`,
  `src/app/api/ical/[token]/route.ts`, `src/app/api/cron/sync-feeds/route.ts`,
  `src/app/dashboard/[businessId]/channels/**`, `src/components/dashboard/feed-controls.tsx`.
- **Build, in this order:**
  1. `safe-fetch.ts` (refuses private network addresses, limits size and time), `parse-feed.ts` (Airbnb-style events
     into nights, time zones respected), `build-feed.ts` (our export, never with guest details).
  2. `addFeed`, `removeFeed`, `syncFeed`, `syncFeedNow`, `getChannelSetup`, `refreshRoomFeeds`, `syncDueFeeds`,
     `buildRoomExport`. Imported nights are `IMPORTED` occupancies: they block, but they are not bookings.
  3. Calendar sync every 15 minutes in `cron-jobs.ts`; `refreshRoomFeeds` before the owner confirms (step 5 of the
     core flow re-reads Airbnb).
  4. Clashes: a platform booking over nights we sold is saved as an active row with `conflict = true`, never
     cancelled or moved. `recheckImportClashes(businessId, roomId)` sets or clears the flags; call it after every
     decision, guest cancel, expiry and closed date (in 3A's and 4B's code, one line each, announced on Discord).
     `notifyImportConflict` tells the hosts once (bell entry; 7A adds the email and push).
  5. The channels screen: each room's export link with a copy button, a form to connect an Airbnb, Booking.com or
     other link, the last sync time and error, and "Sync now".
- **Tests:** `tests/unit/ical.test.ts`, the sync part of `tests/integration/calendar.test.ts` (no copies on a second
  sync; a removed event frees its nights; a clash is marked once and clears when either side cancels).
- **Done when:** the tests pass, an owner connects a real Airbnb calendar link from a phone, and the export link opens
  in Airbnb's import screen.
- **Not in this task:** Kazderni (cut), bookings from the platforms inside our system (cut).

#### 6B. Team and roles

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Thursday.
- **Requirements:** F13.
- **Needs:** 2A.
- **Owns:** the rest of `team-service.ts` and `team-repository.ts`, `src/app/api/workspaces/[businessId]/members/**`,
  `roles/**`, `src/app/dashboard/[businessId]/team/**`, `src/components/dashboard/member-controls.tsx`,
  `role-editor.tsx`, `workspace-switcher.tsx`, `src/components/shell/profile-forms.tsx`.
- **Build, in this order:** invite staff by email (an `Invitation`, accepted on sign-in), change a member's role,
  remove a member; make roles by ticking permissions (nobody gives a permission they do not have; the owner role
  cannot be changed); the switcher between my businesses in the frame; the profile form (name, language).
- **Tests:** `tests/integration/roles.test.ts`.
- **Done when:** the owner invites a front desk member, who signs in and sees only what the role allows.
- **Not in this task:** AI keys (B4).

#### 6C. The full place page

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Thursday.
- **Requirements:** F2.
- **Needs:** 2C, 5C (place cards for "more places").
- **Owns:** `src/app/(site)/p/[slug]/page.tsx` (the full version), `src/app/(site)/p/[slug]/photos/page.tsx`,
  `src/components/place/gallery.tsx`, `photo-tour.tsx`, `photo-browser.tsx`, `listing-summary.tsx`, `amenity.tsx`,
  `share-button.tsx`, `place-art.tsx`, `src/components/listing/*` (`place-map.tsx`, `review-list.tsx`,
  `things-to-know.tsx`).
- **Build, in this order (the sections of `08` Part 8, `/p/[slug]`):** the gallery; under the photos, guests,
  bedrooms, beds and baths, the rating and review count, and who hosts it; the rooms with the booking box; amenities
  with "Show all"; reviews with "Show all"; the map; "Things to know" (house rules, check-in and check-out, "Online
  payments are always refunded in full"); the photo tour grouped by room; sharing. "Show all" opens a popup, a
  full-screen sheet on a phone.
- **Done when:** a guest reads the full page of each demo place on a phone, in English and Arabic.
- **Not in this task:** "Meet your host" and contact host (7C), writing reviews (B6).

---

### Round 7. Telling people

Friday 6 November.

Why together: everything that tells someone something happened. 7A sends the emails (and cancels for the guest), 7B
shows the bell, 7C lets the guest reach the host. They share the activity log (2A) and the `notify` queue (5A), but not
files.

#### 7A. Emails and the guest cancelling

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday.
- **Requirements:** F4 (emailed when anything changes), F4b (the guest cancelling, refunded in full), NFR reliability.
- **Needs:** 5A, 4A, 4C.
- **Owns:** `src/server/services/notification-service.ts`, `src/server/email/templates.ts`,
  `src/components/booking/guest-cancel-button.tsx`, `src/app/api/public/bookings/[token]/cancel/route.ts`.
- **Build, in this order:**
  1. One email template in the guest's language (`Booking.locale`), right-to-left in Arabic, with a plain-text
     version and the booking link.
  2. The guest's emails, each a `notify` job sent after the change is saved: request received, waiting for payment,
     paid, confirmed, declined, expired, cancelled, refunded.
  3. The hosts' emails: a new request, a payment, a guest cancelling, a platform clash (`notifyImportConflict`).
  4. "Cancel my booking" on the booking page, before check-in only, with a full refund when paid online
     (`cancelStayAsGuest`).
- **Tests:** `tests/unit/email.test.ts`, `tests/integration/guest-cancel.test.ts`.
- **Done when:** the tests pass, and on the live site the demo guest gets each email of a booking in mode 2.
- **Not in this task:** push (B7), the bell (7B).

#### 7B. The notification bell

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday.
- **Requirements:** F14a.
- **Needs:** 2A (the activity log), 4A, 4B (their log entries).
- **Owns:** `src/server/services/notification-feed-service.ts`, `src/server/repositories/notification-repository.ts`,
  `src/components/shell/notification-bell.tsx`, `notification-list.tsx`,
  `src/app/api/workspaces/[businessId]/notifications/route.ts`, `src/app/dashboard/[businessId]/notifications/**`,
  `src/app/(site)/account/notifications/page.tsx`.
- **Build, in this order:** the bell in the frame with the latest five things (requests, payments, cancellations,
  refunds, clashes, reviews, team changes), unread since `User.notificationsSeenAt`; each with its icon, its text in
  three languages and its link; "View all" opens the full list, page by page. The guest's account has the same for
  their bookings.
- **Done when:** a new booking and its payment appear in the owner's bell on the other phone.
- **Not in this task:** emails (7A).

#### 7C. Contact the host and the host profile

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Friday.
- **Requirements:** F2a, F7a.
- **Needs:** 6C (the place page), 1A (email).
- **Owns:** `src/server/services/contact-service.ts`, `host-service.ts`, `src/server/repositories/host-repository.ts`,
  `src/app/api/public/places/[slug]/messages/route.ts`, `src/app/(site)/p/[slug]/contact/page.tsx`,
  `src/app/(site)/host/page.tsx`, `src/app/api/workspaces/[businessId]/host-profile/route.ts`,
  `src/app/dashboard/[businessId]/profile/**`, `src/components/place/contact-host-form.tsx`, `meet-host.tsx`,
  `src/components/dashboard/host-profile-form.tsx`.
- **Build, in this order:** the host profile (one per host, shared by all their places: name, bio, languages, hosting
  since, how guests reach them: WhatsApp, Contact host, or both; personal details shown only if the host turns that
  on); "Meet your host" on the place page (years hosting, response rate and time); the Contact host page, which first
  answers what guests ask (getting there, check-in times, how payment works in this mode, cancellation, house rules),
  then a form that emails the host, who replies straight to the guest (rate limited). The WhatsApp number is always
  the place's own.
- **Tests:** `tests/integration/hosts.test.ts`.
- **Done when:** a guest contacts a demo host from a phone, and the host gets the email with the guest's reply address.
- **Not in this task:** in-app chat (cut).

---

### Round 8. The numbers

Saturday 7 November.

Why together: the money and the outcome number we show on stage. 8A is what the owner is owed, 8B is what direct
booking saved them, 8C is the months of believable bookings both screens need to look real.

#### 8A. Payouts to owners

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday.
- **Requirements:** F12a, the payouts part of F16a, NFR money is never doubled.
- **Needs:** 4A.
- **Owns:** `src/server/services/payout-service.ts`, `src/app/api/workspaces/[businessId]/payouts/route.ts`,
  `src/app/dashboard/[businessId]/payouts/**`, `src/components/dashboard/payout-request-form.tsx`,
  `payout-decision.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/money/page.tsx`,
  `src/app/api/admin/payouts/[payoutId]/route.ts`, `src/app/api/admin/refunds/[refundId]/route.ts`.
- **Build, in this order:** what is held for the owner (online payments − refunds − payouts), what is available
  (stays that have started) and what is still coming; a payout request to an IBAN or a Whish number (the form refuses
  anything else; the business row is locked while the balance is checked); the admin money page: payouts to send,
  marked sent with the transfer reference, and failed refunds to send by hand.
- **Tests:** a payout race test (20 requests at once → 1) in `tests/integration/money.test.ts`.
- **Done when:** an owner asks for a payout and an admin marks it sent, from a phone.
- **Not in this task:** the rest of the admin area (B9), automatic payouts (cut).

#### 8B. Analytics and the commission saved

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday.
- **Requirements:** F12, must work on stage 4, demo-ready 5.
- **Needs:** 3A, 4A.
- **Owns:** `src/server/repositories/analytics-repository.ts`, `src/server/services/analytics-service.ts`,
  `src/app/api/workspaces/[businessId]/analytics/route.ts`, `src/app/dashboard/[businessId]/analytics/**`,
  `src/app/dashboard/[businessId]/page.tsx` (the overview), `src/components/dashboard/stat-tile.tsx`,
  `bar-chart.tsx`, `analytics-charts.tsx`.
- **Build, in this order:** `getBusinessReport`, `getAnalytics` (one place or all my places), `getSavings` (safe
  `$queryRaw`, money summed as `::bigint`): occupancy, direct revenue, where bookings come from, response time,
  rating, for any period; and **the commission saved**: direct revenue × the owner's commission rate, plus, since
  joining, what the plan cost and what the host kept. Imported nights are never counted as bookings. The overview
  shows direct bookings and the commission saved first, on a phone; "All my places" for owners with several.
- **Tests:** `tests/integration/analytics.test.ts`.
- **Done when:** the test passes, and the overview shows the demo owner's commission saved this month.
- **Not in this task:** the AI report (B5).

#### 8C. The demo story: months of realistic data

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Saturday.
- **Requirements:** demo-ready 3 and 5.
- **Needs:** 2C (the seed), 4A (payments), 6A (feeds).
- **Owns:** `prisma/seed.ts`, `prisma/seed-history.ts`, `tests/integration/seed.test.ts`.
- **Build, in this order:** about five months of past and two months of upcoming bookings for every demo place, with
  payments, refunds, a payout, reviews, notifications and Airbnb and Booking.com nights; the numbers match the story
  we tell (for example Beyt El Jabal: 4 suites from about $80 a night, so the commission saved is believable, see
  `docs/scope-lock.md` section 10); the two demo phones' accounts. No "(demo)", no "test", no fake Latin text.
- **Tests:** `tests/integration/seed.test.ts` (runs twice without copies; no fake names; every phone starts with
  `+961`; every place has rooms with prices).
- **Done when:** every screen of the demo looks like a real business on the live site.
- **Not in this task:** experiences data (B2).

---

### Round 9. AI and finishing the must-haves

Sunday 8 and Monday 9 November (two days).

Why together: the last must-haves. 9A is the owner's AI (must work on stage 5), 9B is the rest of what an owner sets
up (the whole place, the place's details and photos), 9C makes sure every screen we built behaves calmly and that the
core flow can never silently break.

#### 9A. The owner's AI assistant with the confirm card

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday and Monday.
- **Requirements:** F14 (the dashboard assistant), must work on stage 5, demo-ready 4. Core flow step 7.
- **Needs:** 5A (the `ai` queue), 3A, 3B, 4B, 8B (the services its tools call).
- **Owns:** `src/server/ai/tool.ts`, `run-tool.ts`, `deepseek.ts`, `assistant.ts`, `output.ts`, `team-tools.ts`,
  `src/server/services/assistant-service.ts`, `chat-service.ts`, `ai-usage-service.ts`,
  `src/server/repositories/chat-repository.ts`, `ai-usage-repository.ts`, `src/server/jobs/ai-jobs.ts` (the team
  assistant job), `src/app/api/workspaces/[businessId]/assistant/**`, `src/app/dashboard/[businessId]/assistant/**`,
  `src/components/assistant/chat-panel.tsx`, `team-assistant.tsx`, `action-card.tsx`, `rich-text.tsx`.
- **Build, in this order:**
  1. `defineTool({ name, description, input, requires, mutates, run })`: every tool's input checked with Zod, run with
     the person's `TenantContext`, so the AI can never do more than the person. Tools never take a `businessId`.
  2. The team tools: free rooms, bookings, revenue, **commission saved**, `close_dates`, `cancel_booking`. A tool that
     changes data (`mutates: true`) never runs from the model: it becomes a card with the exact action and its
     validated details, and the owner presses Confirm or Cancel (the actions route runs it).
  3. The loop with DeepSeek (`deepseek.ts`, `assistant.ts`): a 45-second timeout; when the model fails, the figures
     are shown straight from the tools; every figure on screen comes from tool data; guest-written text is wrapped
     with `guestWritten`; every tool call is logged.
  4. The monthly budget (`ai-usage-service.ts`, warned at 80 %, paused at 100 %) and rate limits on the AI routes.
  5. Saved chats, or unsaved and never stored. Short questions answered at once; long ones go to the `ai` queue
     (`runOrQueue`), followed with `api.run`.
- **Tests:** `tests/unit/assistant.test.ts`, `tests/unit/ai-output.test.ts`, `tests/unit/ai-usage.test.ts`,
  `tests/integration/assistant-actions.test.ts`, `tests/integration/chats.test.ts`.
- **Done when:** the owner says "Close the Arched room from 12 to 15 November", checks the card and confirms, and the
  calendar shows it; asks "How much commission did direct bookings save me this month?" and gets the figure with the
  numbers it came from; and with `DEEPSEEK_API_KEY` emptied, gets the figures with a calm message instead.
- **Not in this task:** MCP (B4), the travel assistant (B3), the AI report (B5), streaming (B10).

#### 9B. The whole place and "Your place"

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday and Monday.
- **Requirements:** F3 (renting the whole place), F7 (the place's own details).
- **Needs:** 3A, 3B (photos).
- **Owns:** the whole-place part of `booking-service.ts` and `booking-repository.ts` (in its own section),
  `src/app/dashboard/[businessId]/place/**` (adds to 3B's page), `src/components/dashboard/place-essentials.tsx`.
- **Build, in this order:**
  1. "Your place": description, area and region, address and map pin, house rules, tags, accessibility, minimum
     age, and whether it is rented by room or as a whole place, above 3B's photos on the same page.
  2. The whole place: booked whole, never room by room; the whole place and its rooms block each other; switching
     keeps every booking, and only nights those bookings don't use can be booked the new way; a room stay running when
     the host switches keeps the whole place closed until it checks out; bookings at one place take turns.
- **Tests:** `tests/integration/whole-place.test.ts`.
- **Done when:** the test passes, and an owner fills "Your place", switches a demo place to "whole place", and a guest
  books it whole.
- **Not in this task:** photos (3B), reviews (B6).

#### 9C. Browser tests, calm states and Back buttons

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Sunday and Monday.
- **Requirements:** F21, demo-ready 1 ("handles a wrong or empty input calmly"), NFR quality.
- **Needs:** every task up to Round 8 (merged).
- **Owns:** `playwright.config.ts`, `tests/e2e/*`, `scripts/lib/e2e.ts`, `package.json` (`test:e2e`), the e2e job in
  `.github/workflows/ci.yml`, and `loading.tsx` / empty-state fixes in any screen (announced on Discord, one small pull
  request per area so the owner of the screen reviews it).
- **Build, in this order:**
  1. Playwright on a 390-pixel phone screen: `core-flow.spec.ts` (a guest books and pays, the owner confirms, the guest
     sees "confirmed"), `double-booking.spec.ts` (two browsers, one night: one wins, the other sees "Those dates were
     just taken"), `mobile-and-languages.spec.ts` (no sideways scrolling, English and Arabic).
  2. Every screen: a `loading.tsx`, an empty state, and calm errors for wrong or empty input (`08` Part 7).
  3. Every page has a Back button to the page it belongs to (F21), also after a refresh or from a shared link.
- **Done when:** `pnpm test:e2e` passes locally and in CI, and nothing in the core flow scrolls sideways on a phone.
- **Not in this task:** the AI browser test (10B).

---

### Round 10. Demo-ready

Tuesday 10 November. Checkpoint 2 is Tuesday evening.

Why together: proving it works on stage. 10A proves the safety rules everywhere, 10B makes the AI safe to show live,
10C turns it into the three-minute story.

#### 10A. Prove business isolation and roles everywhere

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Tuesday.
- **Requirements:** NFR business isolation, least privilege, privacy, nothing is deleted.
- **Needs:** every owner task.
- **Owns:** `tests/integration/tenant-isolation.test.ts` (finished), `tests/integration/roles.test.ts` (added cases).
- **Build:** for rooms, bookings, calendar, feeds, team, settings, analytics, payouts and the assistant: business A's
  owner calling B's routes with B's real ids gets 404 and B's data does not change; front desk gets 403 where the role
  says so; hidden contacts stay hidden; soft-deleted rows stay in the database and out of sight.
- **Done when:** the tests pass in CI.

#### 10B. The AI on stage: scripted tests and fallbacks

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Tuesday.
- **Requirements:** demo-ready 4, must work on stage 5.
- **Needs:** 9A, 9C.
- **Owns:** the scripted AI model used only by tests (`04` Part 4), `tests/e2e/ai-action.spec.ts`.
- **Build:** the scripted model; `ai-action.spec.ts` (the owner asks to close dates, sees the card with the exact room
  and dates, confirms, the calendar shows them closed; and a wrong order, such as a room name that fits two rooms,
  is refused with the reason); the slow and failing model paths checked by hand on the live site; the one
  architecture slide's facts (where the model sits, what it decides, how its output is checked, what happens when it
  is wrong).
- **Done when:** the spec passes, and the fallback works live with the key removed.

#### 10C. The three-minute story and the demo accounts

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **When:** Tuesday.
- **Requirements:** demo-ready 2, 5 and 6; `docs/scope-lock.md` sections 10 to 12.
- **Needs:** 8B, 8C.
- **Owns:** `docs/demo-script.md`, the `[FILL]` lines of `docs/scope-lock.md`.
- **Build:** the 3-minute script draft (0:00 problem, 0:30 live core flow, 2:15 architecture slide, 2:45 the outcome
  number); the two demo phones already signed in (guest and owner) and how to reset them before each run; the outcome
  number confirmed with a real host if possible (else the clearly labelled seeded pilot); the backup plan (hotspot,
  the AI fallback, an already-synced calendar with "Sync now").
- **Done when:** the three of us run the script once, on time, on the live URL.

#### Checkpoint 2 (Tuesday 10 November, evening): everyone

Run the whole demo twice on the live URL, on two phones: the core flow in mode 2, the second guest refused, the
Airbnb night blocking and our night closing on Airbnb, the commission saved, and the AI order and question. Post the
Checkpoint 2 standup. From Wednesday: no new features.

---

## 6. The bonus queue

Only after every must-have of the current round is merged. Whoever finishes their task early takes the **next bonus
in this order** (the order of the scope's bonus list), writes their name here, and says it on Discord. Each bonus has
its tables already in the database. Any bonus not merged by Tuesday 10 November is dropped, not rushed.

| Id  | Bonus                                                      | Requirements | Needs      | Owner |
| --- | ---------------------------------------------------------- | ------------ | ---------- | ----- |
| B1  | Host plans paid instantly with Stripe or Whish             | F15          | 4A         |       |
| B2  | Experiences and services, with sessions and seats          | F8, F2       | 3A, 4A     |       |
| B3  | The guest's travel assistant                               | F6           | 5C, 9A     |       |
| B4  | Connecting Claude, Cursor or Codex (host MCP, keys, OAuth) | F14          | 9A         |       |
| B5  | The AI report                                              | F12          | 8B, 9A     |       |
| B6  | Reviews and favourites                                     | F5           | 4C         |       |
| B7  | Push notifications                                         | F19          | 7A         |       |
| B8  | Installing the app                                         | F20          | 1B         |       |
| B9  | The admin area                                             | F16, F16a    | 8A         |       |
| B10 | Answers word by word, and queued answers                   | F14b         | 5A, 9A     |       |
| B11 | Booking through the guest's AI and the guest MCP (last)    | F6a          | B3, B4, 4C |       |

- **B1. Plans.** Free, Pro, Business with their limits (`src/config/plans.ts`); paid instantly by Stripe
  subscription (switched on when Stripe confirms) or Whish (a month at a time). No paying by hand, no receipts, no
  admin approval. `billing-service.ts`, the pricing page, the billing page. Test: `tests/integration/billing.test.ts`.
- **B2. Experiences and services.** Hikes, tastings, transfers with repeating sessions and seats; their page with
  spots left; booking seats with the same three modes (the seat trigger refuses overbooking).
  `offering-service.ts`, `session-booking-service.ts`. Test: `tests/integration/session-seats.test.ts`.
- **B3. The travel assistant.** A trip in English, Arabic or Arabizi → places really free on those dates; region, bedrooms,
  bathrooms, beds, amenities (a jacuzzi), tags; read-only, it links to the booking page. `guest-tools.ts`,
  `askConcierge`, `/api/assistant`, `/api/me/chats`, `concierge.tsx`. Tests: `place-search.test.ts`,
  `concierge-cards.test.ts`.
- **B4. MCP.** `mcp-server.ts`, `/api/mcp` and `/api/mcp/guest`, `mcp-token.ts`, personal keys (`api-key-service.ts`,
  `key-manager.tsx`) and OAuth sign-in; write tools marked as changing data; read-only keys never see them. Tests:
  `mcp-server.test.ts`, `mcp-isolation.test.ts`.
- **B5. The AI report.** The AI writes a report from `getBusinessReport`, on the `ai` queue. `report-service.ts`,
  `report-generator.tsx`.
- **B6. Reviews and favourites.** One review per stay, after check-out, by the guest who stayed; the host can answer;
  favourites with the heart button. `review-service.ts`, `favorite-service.ts`.
- **B7. Push.** `push-service.ts`, `public/sw.js`, the phone alerts switch; every update that is emailed. Test:
  `tests/unit/push.test.ts`.
- **B8. Install.** `manifest.ts`, icons, the offline page, the install button.
- **B9. Admin area.** Platform numbers, every host with their businesses, suspend or reactivate, open a business to
  help (logged under the admin's name), categories, the site palette, sync health and AI spending.
- **B10. Word by word.** Streaming the answer while it is written (`JobProgress`), "Searching what's free…" steps.
  Test: `tests/unit/deepseek-stream.test.ts`.
- **B11. Booking through the AI.** After the guest says yes, the AI makes the booking and gives its link; it never
  pays. The guest pays on the booking page, so the 10-minute window and every rule stay the same.

---

## 7. Round 11. Release

Wednesday 11 to Friday 13 November. No new features. These three tasks run together until the submission.

#### 11A. Bugs and the live site

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **Build:** run the core flow on the live site every morning; fix the bugs found while rehearsing (each of us still
  fixes bugs in our own tasks, this task tracks and triages them); check the worker, the scheduled jobs, the AI
  budget and the Stripe and Whish settings on the live site; a database backup before Demo Day.

#### 11B. Polish the demo screens

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **Build:** every screen of the demo at 390 pixels, in English and Arabic, light and dark: spacing, text, loading
  and empty states, the Arabic wording (Lebanese Arabic in spoken style). Only the screens of the demo.

#### 11C. Documents and the backup video

- **Owner:** \_\_\_\_\_\_\_\_\_\_\_\_
- **Build:** `scripts/openapi.ts`, which generates `docs/openapi.json` from the routes' Zod schemas (like the
  reference), and `tests/unit/openapi.test.ts` (every API route is in the contract); then `pnpm docs` (ERDs and the
  API contract in JSON and YAML), the README, the requirements matrix up to date,
  the demo script final; **record the backup video of the full demo on Thursday 12 November** (two of us: one films,
  one demos), and submit on Friday 13 November.

---

## 8. How nobody waits for anybody

1. **Round 0 is ready.** Everyone starts on Friday evening from a working repository with every table.
2. **Shared building blocks come first, for real.** The server base, the design basics, the permission list (Round 1),
   tenancy (Round 2), the booking engine (Round 3) are final from the first day. We never write fake or temporary
   versions of them.
3. **Start with the parts that need nothing new.** Every task lists its steps in the order that needs the least from
   others.
4. **Connect the last step when the building block is merged.** The few same-round connections are written in the
   task's Needs line, and the exact function is in `02` Part 14.

When something you use is late:

- Keep working on the parts that do not need it. Every task has enough of them.
- Never edit another person's files. Ask on Discord, or write what you need in your pull request.
- Only the owner of a contract changes it, in a small pull request, announced on Discord.
- Stuck for more than one hour? Say it on Discord. Stuck for one day? Mark your standup Amber.

---

## 9. How we use GitHub

### Nobody pushes to `main` directly

Every change goes through a pull request. To merge, a pull request needs all checks green, one approval, the branch up
to date with `main`, and every comment answered. When a pull request is merged, the live website updates by itself
(from task 3C).

### One branch per task

Name: `<type>/<task-id>-<short-name>`, for example `feat/3A-booking-engine`, `feat/4C-book-page`,
`fix/4B-confirm-button`. Types: `feat` (new), `fix` (a bug), `refactor` (same behaviour, cleaner), `test`, `docs`,
`chore` (tools and setup).

```
git switch main
git pull
git switch -c feat/4C-book-page
```

### Small pull requests, opened early

- One pull request does one thing, under about 400 changed lines. Split big tasks: 2C can be the seed, the price
  routes, and the booking box.
- Open a draft pull request after your first commit, so the others see what is coming.
- Commit messages say what changed for the user: "Guests see taken nights greyed out", not "update picker".

### What to write in every pull request

```
## What this changes
One or two sentences, from the user's point of view.

## Task
3A / 4B / 6C …

## How to check it
Steps to try it, and which demo account to use.

## Screenshots
Phone width (390 px), in English and Arabic, for any screen change.

## Checklist
- [ ] `pnpm check` passes on my computer
- [ ] The integration tests for this feature pass
- [ ] Every new text is in all three language files
- [ ] Files are in the right folders (05-project-structure.md)
- [ ] No database change (or: it came in its own pull request from the database keeper)
- [ ] The documents that describe what I changed are updated
```

### Reviews

A pull request is reviewed within half a day (the rounds are short). The review checks the layers (route → service →
repository), permissions in the service, a Zod check on every input, no repeated code and no hand-typed value lists,
colour tokens only, text in every language, and the tests from `04-test-plan.md`. Each comment is **must fix** (blocks
the merge) or **suggestion** (the author decides). Answer every comment, push fixes as new commits, ask again.

### Merging

Use **Squash and merge** and delete the branch. If `main` changed: `git pull --rebase origin main`, fix conflicts, run
the checks again, `git push --force-with-lease`.

### Never put secrets in the repository

No keys, passwords or tokens in code, commits, screenshots or Discord. Your own go in `.env` (git ignores it). Live
ones go in DigitalOcean's settings and GitHub secrets. If a secret is pushed by mistake, say so at once: it must be
replaced, not just deleted.

---

## 10. A normal day

- **Morning:** pull `main`, update your branch, read review comments, review the others' pull requests first (a
  waiting review blocks a teammate).
- **During the day:** small steps with Claude (`03-claude-prompt-guide.md`, one task per conversation), the checks
  before every push, ask on Discord after one hour stuck.
- **Evening, by 9:00 PM:** the standup, and push your work to your branch, even unfinished.

## 11. If we are late

Cut, never rush. If a checkpoint is at risk, cut extras first: the week and rooms views of the calendar, special
prices, the bonus queue, Arabic polish. Never cut the core flow or its tests. If a must-have is still missing near 13
November, we can copy it from the reference project together, through a normal pull request and review.
