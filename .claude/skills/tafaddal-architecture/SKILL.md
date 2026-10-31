---
name: tafaddal-architecture
description: How Tafaddal's code is built - the four layers (routes, services, repositories, database), tenantRoute and TenantContext, errors, Zod checks, jobs, the booking engine and the contracts other tasks call. Use before writing or changing any server code, API route or service.
---

# Tafaddal architecture

Read before writing server code:

- `docs/team/02-architecture-and-features.md`: Parts 3 to 6 (layers, requests and errors, sign-in and permissions,
  the database), the feature you are building in Part 7, the checklist in Part 13, and the contracts in Part 14.
  Build against those exact function shapes, even before they are merged.
- `docs/team/05-project-structure.md`: where each new file goes and how it is named.
- `docs/architecture.md`: the booking race, calendar sync, queues and workers, payments, AI and MCP.
- `docs/openapi.json`: the API contract. A route you add or change must match it, and the contract is updated in the
  same pull request (`pnpm docs` also writes `docs/openapi.yaml`).

The rules that are never broken (from `CLAUDE.md`): routes call one service and never the database; services check
permissions first; only repositories query, always filtered by `businessId`; settings come from `env`; slow or
must-happen work is a job. When the code and a document disagree, say so instead of guessing.
