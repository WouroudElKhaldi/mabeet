---
name: tafaddal-tests
description: Write Mabeet tests - unit, integration (real Postgres), race tests, database rule tests and Playwright end-to-end tests, and which tests each feature needs. Use when writing or fixing any test, or when a task's "Tests" line names test files.
---

# Mabeet tests

Read `docs/team/04-test-plan.md`: Part 2 (how to write each kind), the rows for your feature in Part 3, Part 4 for
end-to-end tests, and Part 6 (the minimum at each checkpoint).

- Unit tests go in `tests/unit/`, with no database. Integration tests go in `tests/integration/`, on the test
  database (`TEST_DATABASE_URL`), using the helpers in `tests/integration/helpers.ts` and `http.ts`.
- Code that depends on the time takes `now`; tests pass it instead of waiting.
- Run one file: `pnpm exec vitest run --project integration tests/integration/<file>.test.ts`. Run the checks one at
  a time, never next to `pnpm dev` on a small computer.
- Never weaken or skip a test to make it pass. If a test shows a real bug outside your task, report it.
