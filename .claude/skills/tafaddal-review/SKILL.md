---
name: tafaddal-review
description: Review a Mabeet pull request or a branch's changes against the team's rules, before a teammate reviews it. Use when asked to review, check a pull request, or say whether something is ready to merge.
---

# Reviewing a Mabeet pull request

1. Find the feature in the branch name or the pull request (`feat/F9-...`) and read its requirement in
   `docs/team/06-functional-requirements.md` and its section in `docs/team/02-architecture-and-features.md`: did it
   build what they say, and nothing from the scope's cut list? An API pull request comes before its screens.
2. Check against Part 13 of `docs/team/02-architecture-and-features.md` (the checklist for any new code) and the
   review list in `docs/team/README.md` ("How we work"): layers, permissions in the service, a Zod check on every input, no repeated
   code or hand-typed value lists, tokens only, text in all three languages, the tests from `04-test-plan.md`,
   documents updated, no secrets.
3. For screens, also Part 9 of `docs/team/08-design-system-and-pages.md`.
4. Report each finding as **must fix** (with the file and line, and why) or **suggestion**. Say which checks you ran.
