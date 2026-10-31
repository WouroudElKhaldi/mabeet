# Team documents

These files explain the project we are building for Demo Day (Saturday 21 November). They say what to build, how
the code is organised, and how we work together. Claude reads them too (see `CLAUDE.md`).

Read them in this order before your first task:

| File                                                               | What it tells you                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [01-work-split.md](01-work-split.md)                               | Who owns which files, and the order for Checkpoint 1 |
| [02-architecture-and-features.md](02-architecture-and-features.md) | How each feature works and how the code is built     |
| [03-claude-prompt-guide.md](03-claude-prompt-guide.md)             | The rules for Claude, and how to ask Claude for work |
| [04-test-plan.md](04-test-plan.md)                                 | Which tests to write, who writes them, and how       |
| [05-project-structure.md](05-project-structure.md)                 | All folders and files, and where each new file goes  |
| [06-functional-requirements.md](06-functional-requirements.md)     | What the new project does: must have and bonus       |
| [07-data-model.md](07-data-model.md)                               | What changes in the database for the new project     |
| [08-design-system-and-pages.md](08-design-system-and-pages.md)     | Colours, fonts, spacing, components, and every page  |

These files describe a **reference project**: the first version of Mabeet, in the `se-next-stays` repository. Its code already
follows every rule written here. So when a file says "copy the style of `booking-service.ts`", that file (in the
reference project, until we have written ours) is the example. We are building it again as a team, in this
repository. The files name features by their requirement id in `06` (`F3`, `F22`), never by person.

Claude Code also has these files as **skills** (in `.claude/skills/`): when you ask for a feature, Claude loads the
architecture, the design system or the test plan by itself. `CLAUDE.md` is copied from Part 1 of
`03-claude-prompt-guide.md`; change both together.

---

## How we work

### Who builds what

Who owns which files, and the order until Checkpoint 1, is in `01-work-split.md`. Omar owns the deployment and the
live site, and Fatima gives the pitch. Before you start something, say on Discord what you take and which files you will change. Never
change a file someone else is working on; ask them instead, or write what you need in your pull request.

The order: the must-haves of `06` Part A first (the core flow of `docs/scope-lock.md`, section 5, before anything
else), then the bonuses in the order of `docs/scope-lock.md`, section 9. The dates are in `docs/scope-lock.md`,
section 12.

### Backend first, then the screens

Each feature is built by one person, from the database to the screen, in two pull requests:

1. **The API** (for example `w-rooms-api`): repositories, the service, the routes with their Zod schemas, the route in
   `docs/openapi.json` (then `pnpm run docs`), and the unit and integration tests. Before asking for a review, run the
   routes by hand in Postman or Swagger (`04` Part 2, "Checking an API by hand"). Merged first.
2. **The screens** (for example `w-rooms-screens`): the pages and components on the merged routes, with `api` from
   `src/lib/api-client.ts`, every text in the three message files, the `loading.tsx` and the empty state.

The shared bases come before any feature, so nobody writes their own: the server base (`env`, errors, the database
client and `runInTransaction`, the route wrapper, sign-in), the design system and its components
(`src/components/ui`, the frames, `api-client.ts`, the hooks), and the value lists, permissions and languages
(`src/config`, `permissions.ts`, `messages/*`).

### All or nothing

A change with several steps either happens completely or not at all: if step 2 fails, step 1 is undone, we fix the
cause and run it again from step 1. Every database step goes in one `runInTransaction`; outside services (Stripe,
Whish, R2, email) are called after the commit; a failed migration is marked rolled back, fixed and run again; a
merged pull request is undone with `git revert`. The exact rules: `02` Part 3, "All or nothing: when one step fails".

### Shared files

Many features change these. Add your lines in the block for your feature, keep the existing order, and pull `development`
every morning so conflicts stay small:

- `src/lib/schemas.ts` (only the small input pieces every module shares; each module's own checks are in its
  `schemas.ts`)
- `messages/en.json`, `messages/ar.json`, `messages/ar-LB.json` (one block per area, same keys in all three)
- `src/components/dashboard/nav-items.ts` (one line per dashboard page)
- `docs/openapi.json`: a route you add or change is written there, matching its Zod schema, then `pnpm run docs` (which
  also writes `docs/openapi.yaml`). Once `scripts/openapi.ts` exists, it generates the file from the schemas instead
- `knip.json`: the first change that imports a library removes it from `ignoreDependencies`

### The database keeper

`prisma/schema.prisma` and `prisma/migrations/` are complete for every feature except the partner tables
(`07-data-model.md`, section 5). A database change goes through **one person**, the database keeper: write what you
need in your pull request or on Discord, and it comes in its own small pull request first. Never edit a merged
migration; add a new one.

Database keeper: **Wouroud**.

### GitHub

- **Three kinds of branches:**
  - `main`: what is live. A merge to `main` updates the live site by itself. Changed only by a release pull request
    from `development`.
  - `development`: where the three of us put our work together and test it. Every feature branch starts from it and
    goes back into it.
  - Feature branches, one per pull request, made from `development`: the first letter of your name, a dash, and
    what you are doing, in lowercase words joined by dashes: `w-` for Wouroud, `f-` for Fatima, `o-` for Omar. For
    example `w-core-server-base`, `f-place-page-screens`, `o-rooms-api`, `o-fix-confirm-button`. The pull request
    names the feature (`F7`, …).

  ```
  git switch development
  git pull
  git switch -c w-core-server-base
  ```

- **Nobody pushes to `main` or `development` directly.** Every change is a pull request with all checks green, one
  approval, the branch up to date with its target, and every comment answered.
- **A feature goes into `development`:** open the pull request into `development` (not `main`), and use **Squash
  and merge**, then delete the branch. If `development` changed meanwhile: `git pull --rebase origin development`,
  run the checks again, `git push --force-with-lease`.
- **`development` goes into `main` (a release):** when the three of us have tested our work together on
  `development` (the core flow, on phones, in English and Arabic) and nothing is wrong, one of us opens a pull
  request from `development` into `main`. It needs green checks and one approval, and is merged with **Create a merge
  commit**, never squashed, so `main` and `development` keep the same history. After it, `development` already holds
  everything in `main`.
- **Small pull requests, opened early:** one thing each, under about 400 changed lines; a draft after the first
  commit; commit messages say what changed for the user ("Guests see taken nights greyed out").
- **Every pull request says:** what it changes (for the user), the feature (`F7`, …), how to check it (steps and
  the demo account; for an API, what you ran in Postman or Swagger), screenshots at 390 px in English and Arabic for
  any screen, and the checklist: `pnpm check` passes, the feature's integration tests pass, every new text is in the
  three message files, files are in the right folders (`05`), no database change (or it came from the database
  keeper), the documents that describe the change are updated.
- **Reviews**, within half a day: the layers, permissions in the service, a Zod check on every input, all or nothing
  for changes with several steps, no repeated code or hand-typed value lists, tokens only, text in every language,
  the tests from `04`. Each comment is **must fix** or **suggestion**.
- **Undoing a merged change:**
  - **A feature that broke `development`:** every feature is one squashed commit there, so make a branch from
    `development`, `git revert <the commit>`, and open it as a pull request into `development`.
  - **A release that broke the live site:** make a branch from `main`, `git revert -m 1 <the release's merge
commit>`, and open it as a pull request into `main`; the site goes back to the release before. Then fix the
    problem on `development` as usual. Before the next release, revert that revert on `development` (`git revert
<the revert commit>`), or the reverted work never comes back to `main`.
  - A migration is never deleted: a new migration undoes it. On your own branch, start a step again with
    `git restore` or `git reset`; never rewrite `main` or `development`.
- **Never put secrets in the repository:** no keys, passwords or tokens in code, commits, screenshots or Discord.
  Yours go in `.env`; live ones in DigitalOcean's settings and GitHub secrets. A secret pushed by mistake is
  replaced, not just deleted.

---

## Glossary: words you will see

**API route**
A web address the app calls to get or change data, for example `POST /api/workspaces/{businessId}/rooms`. In the
code, each one is a `route.ts` file under `src/app/api/`.

**Booking engine**
The functions that save and change bookings safely, so two guests never get the same room on the same night.

**Branch**
Your own copy of the code in Git, where you work on one task without changing `development` or `main`.

**CI (checks)**
Automatic checks that run on GitHub for every pull request: types, lint, format, unused code and tests. A red check
blocks the merge.

**Clash**
An Airbnb or Booking.com booking on nights we already sold. It is kept and marked (`conflict = true`), never
cancelled; the hosts are told once, and it clears when either booking is cancelled.

**Contract**
The agreed shape of a function: its name, what it takes in, and what it gives back. Contracts are written in
`02-architecture-and-features.md`, so everyone knows how to call a function before it is merged.

**Demo data (seed)**
Example data put in the database so screens have something to show: guesthouses, rooms, bookings.

**Design token**
A named colour, size or shadow, such as `bg-surface` or `text-muted`. We only use tokens, never raw colours like
`#ff0000`.

**End-to-end test (e2e)**
A test that opens a real browser and clicks through the app like a person.

**Feature**
Something a user can do, such as "a guest requests a stay" or "an owner closes dates".

**iCal**
A calendar file format. Airbnb and Booking.com share their calendars as iCal links. We read them (import) and we
publish our own (export).

**Integration test**
A test that uses a real database. It checks that the code and the database work together.

**Layers**
The code is split in four levels: routes, services, repositories, database. Each level only talks to the next one.

**MCP**
A standard way for AI apps (Claude, Cursor, Codex) to call our tools. Our MCP server lets an owner ask their AI app
about their business.

**Merge**
Adding your branch's changes into another branch: a feature into `development`, a release into `main`.

**Minor units (cents)**
How money is stored: a whole number of the currency's smallest unit, so 99.99 is `9999`. Columns end in `Cents`,
are `BigInt` in the database (LBP prices are large), and are plain numbers in the code.

**Migration**
A file that changes the database structure (adds a table or a column). Migrations run in order and are never edited
after they are merged.

**Occupancy**
A row that says "this room is taken from this night to this night". Bookings, closed dates and Airbnb stays are all
occupancies.

**Permission**
A right to do something, such as `bookings.decide` (confirm or decline bookings). Roles are lists of permissions.

**Pull request (PR)**
A request on GitHub to merge your branch into `development` (or, for a release, `development` into `main`). Others
review it first.

**Redis**
A small in-memory store running beside the website in Docker. We use it only to count requests for rate limits.

**Repository (repo)**
The project's code on GitHub.

**Repository file (in the code)**
A file in `src/modules/<name>/server/`. It is the only place that talks to the database.

**Review**
Another person reads your pull request and comments before it is merged.

**Role**
A named set of permissions, such as "Owner" or "Front desk".

**Schema (database)**
The list of tables and columns, in `prisma/schema.prisma`.

**Schema (Zod)**
A check for input data, for example "the phone must start with +". They live in each module's `schemas.ts`.

**Service**
A file in `src/modules/<name>/server/`. It holds the business rules and the permission checks.

**Soft delete**
Marking a row `isDeleted = true` instead of removing it. Business data is never really deleted; every read skips
deleted rows.

**Tenant / tenancy**
Each business is a tenant. Tenancy means each business only sees its own data.

**`TenantContext`**
An object that says who is acting, in which business, and with which permissions. Every service receives it.

**Unit test**
A small, fast test with no database. It checks one function.
