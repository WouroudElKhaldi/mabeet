# Team documents

These files explain the project we are building for Demo Day (Saturday 21 November). They say what to build, how
the code is organised, and how we work together. Claude reads them too (see `CLAUDE.md`).

Read them in this order before your first task:

| File                                                               | What it tells you                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [01-team-plan.md](01-team-plan.md)                                 | Every task in order, three at a time, and the dates  |
| [02-architecture-and-features.md](02-architecture-and-features.md) | How each feature works and how the code is built     |
| [03-claude-prompt-guide.md](03-claude-prompt-guide.md)             | The rules for Claude, and how to ask Claude for work |
| [04-test-plan.md](04-test-plan.md)                                 | Which tests to write, who writes them, and how       |
| [05-project-structure.md](05-project-structure.md)                 | All folders and files, and where each new file goes  |
| [06-functional-requirements.md](06-functional-requirements.md)     | What the new project does: must have and bonus       |
| [07-data-model.md](07-data-model.md)                               | What changes in the database for the new project     |
| [08-design-system-and-pages.md](08-design-system-and-pages.md)     | Colours, fonts, spacing, components, and every page  |

These files describe a **reference project**: the first Mabeet, in the `se-next-stays` repository. Its code already
follows every rule written here. So when a file says "copy the style of `booking-service.ts`", that file (in the
reference project, until we have written ours) is the example. We are building it again as a team, in this
repository, following `01-team-plan.md`.

Who does what is written **only** in `01-team-plan.md`. The other files name tasks by their id (`3A`, `9C`, `B4`),
never by person.

Claude Code also has these files as **skills** (in `.claude/skills/`): when you ask for a task, Claude loads the
plan, the architecture, the design system or the test plan by itself. `CLAUDE.md` is copied from Part 1 of
`03-claude-prompt-guide.md`; change both together.

---

## Glossary: words you will see

**API route**
A web address the app calls to get or change data, for example `POST /api/workspaces/{businessId}/rooms`. In the
code, each one is a `route.ts` file under `src/app/api/`.

**Booking engine**
The functions that save and change bookings safely, so two guests never get the same room on the same night.

**Branch**
Your own copy of the code in Git, where you work on one task without changing `main`.

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
Adding your branch's changes into `main`.

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
A request on GitHub to merge your branch into `main`. Others review it first.

**Redis**
A small in-memory store running beside the website in Docker. We use it only to count requests for rate limits.

**Repository (repo)**
The project's code on GitHub.

**Repository file (in the code)**
A file in `src/server/repositories/`. It is the only place that talks to the database.

**Review**
Another person reads your pull request and comments before it is merged.

**Role**
A named set of permissions, such as "Owner" or "Front desk".

**Schema (database)**
The list of tables and columns, in `prisma/schema.prisma`.

**Schema (Zod)**
A check for input data, for example "the phone must start with +". They live in `src/server/validation/schemas.ts`.

**Service**
A file in `src/server/services/`. It holds the business rules and the permission checks.

**Soft delete**
Marking a row `isDeleted = true` instead of removing it. Business data is never really deleted; every read skips
deleted rows.

**Tenant / tenancy**
Each business is a tenant. Tenancy means each business only sees its own data.

**`TenantContext`**
An object that says who is acting, in which business, and with which permissions. Every service receives it.

**Unit test**
A small, fast test with no database. It checks one function.
