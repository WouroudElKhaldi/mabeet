---
name: tafaddal-task
description: Start, continue or finish a Mabeet feature, by its requirement id (F3, F7, F22...) or its name ("the booking engine", "rooms and prices"). Use whenever someone asks to build, continue or check a feature.
---

# Working on a feature

1. Read the feature's requirement in `docs/team/06-functional-requirements.md`, its section in
   `docs/team/02-architecture-and-features.md` (Part 7, and the contracts in Part 14), its tests in
   `docs/team/04-test-plan.md`, where its files go in `docs/team/05-project-structure.md`, and for screens its page in
   `docs/team/08-design-system-and-pages.md` Part 8. Then "How we work" in `docs/team/README.md`.
2. Ask what it needs that is not merged in `development` yet. Build only the parts that do not need it, and say exactly what
   is left to connect. Never write a fake or temporary version of someone else's code.
3. Ask which files the person may change, or say which ones you will. Never change a file someone else is working on;
   the shared files of `docs/team/README.md` only in your own block. If you need another file, stop and say so.
4. Work on a branch made from `development`; the pull request goes into `development`, never `main`. Backend first: the API pull request (repositories, service, routes with their Zod schemas, `docs/openapi.json`
   and `pnpm docs`, the unit and integration tests, checked by hand in Postman or Swagger), then the screens pull
   request on the merged routes.
5. Follow `CLAUDE.md`, and load the other skills when the work touches them: `tafaddal-architecture` (layers, routes,
   services, contracts), `tafaddal-screens` (any page or component), `tafaddal-database` (queries, schema),
   `tafaddal-tests` (the tests), `tafaddal-scope` (is it in scope?).
6. Plan first, then build, then check. Never build anything on the scope's cut list (`docs/scope-lock.md`).
7. Finish with "Before you say a task is done" in `CLAUDE.md`, and report what you verified and how.
