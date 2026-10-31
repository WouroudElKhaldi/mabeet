---
name: tafaddal-database
description: Tafaddal's database - the Prisma schema, migrations, the no-double-booking EXCLUDE constraint, money as BigInt cents, soft delete, locks, and who may change the schema. Use before writing a repository query, raw SQL or a seed, or when a task seems to need a database change.
---

# Tafaddal database

Read `docs/team/07-data-model.md` (the rules, and what changed from the reference), `docs/erd.md` (every table and
column, made from `prisma/schema.prisma`), `docs/erd-explained.md` (what each table means), `docs/data-model.md`,
and Part 6 of `docs/team/02-architecture-and-features.md` (occupancy, money tables, soft delete, locks).

- The schema already has every table, including the bonus features. Only the database keeper named in
  `docs/team/01-team-plan.md` changes `prisma/schema.prisma` or adds a migration. If a task needs a change, stop and
  write exactly what is needed.
- Never edit a merged migration; add a new one. Raw SQL in a migration for what Prisma cannot express (EXCLUDE,
  CHECK, triggers, data moves); a new rule that old rows break is added `NOT VALID`.
- Every taken night is an `Occupancy` row, and the database refuses overlaps. Anything that changes a room's nights
  runs in `runInTransaction` with `lockActiveRoom` first.
- Money is `BigInt` minor units, read as numbers through `moneyAsNumbers`. Business rows are soft deleted
  (`isDeleted`), and every read filters them out.
- After a schema change: `pnpm exec prisma generate`, `pnpm docs`, and update `07-data-model.md`.
