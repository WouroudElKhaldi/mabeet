---
name: mabeet-task
description: Start, continue or finish a task from the Mabeet team plan, by its id (1A, 4B, 9C, B4...) or its name ("the booking engine", "rooms and prices"). Use whenever someone asks to build, continue or check a planned task.
---

# Working on a planned task

1. Read `docs/team/01-team-plan.md` fully, then the task's own entry: **Requirements**, **Needs**, **Owns**,
   **Build, in this order**, **Gives the others**, **Tests**, **Done when**, **Not in this task**.
2. Check **Needs**: every task it names must be merged in `main`. If one is not, build only the steps that do not
   need it, and say exactly what is left to connect. Never write a fake or temporary version of another task's code.
3. Only create or change the files listed in **Owns**, plus the shared files of section 2 of the plan. If you need to
   change a file another task owns, stop and say so.
4. Follow `CLAUDE.md`, and load the other skills when the work touches them: `mabeet-architecture` (layers, routes,
   services, contracts), `mabeet-screens` (any page or component), `mabeet-database` (queries, schema),
   `mabeet-tests` (the tests in **Tests**), `mabeet-scope` (is it in scope?).
5. Build the steps in the order written. Plan first, then build, then check.
6. Never build what **Not in this task** lists, nor anything on the scope's cut list (`docs/scope-lock.md`).
7. Finish with "Before you say a task is done" in `CLAUDE.md`, then check every line of **Done when** and report
   which ones you verified and how.
