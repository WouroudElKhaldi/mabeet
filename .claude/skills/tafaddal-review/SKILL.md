---
name: tafaddal-review
description: Review a Tafaddal pull request or a branch's changes against the team's rules, before a teammate reviews it. Use when asked to review, check a pull request, or say whether something is ready to merge.
---

# Reviewing a Tafaddal pull request

1. Find the task id in the branch name or the pull request (`feat/4B-...`) and read its entry in
   `docs/team/01-team-plan.md`: did it build what **Build** says, only in the files it **Owns**, and nothing from
   **Not in this task**?
2. Check against Part 13 of `docs/team/02-architecture-and-features.md` (the checklist for any new code) and the
   review list in section 9 of the plan: layers, permissions in the service, a Zod check on every input, no repeated
   code or hand-typed value lists, tokens only, text in all three languages, the tests from `04-test-plan.md`,
   documents updated, no secrets.
3. For screens, also Part 9 of `docs/team/08-design-system-and-pages.md`.
4. Report each finding as **must fix** (with the file and line, and why) or **suggestion**. Say which checks you ran.
