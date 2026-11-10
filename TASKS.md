# Tasks

My working list. Each feature gets its own branch from `development`; PRs go into `development`, never merged by me.

## In progress

- [x] **Rooms and prices screen** (`w-host-rooms-screen`): pushed, PR to open.
- [x] **Settings screen** (`w-host-settings-screen`): pushed, PR to open.
- [x] **Place screen** (`w-host-place-screen`): pushed. Open its PR after the rooms and settings PRs are merged.
- [x] Workspaces and rooms integration tests on the host screen branches: pass.
- [x] **Calendar and close dates screen** (`w-host-calendar-screen`): pushed, PR to open. Its menu line sits next to
      the rooms and settings ones: on a merge conflict in `nav-items.ts`, keep every line.

## Next

- [x] **Account privacy** (`w-account-privacy`): pushed, PR to open. It changes the top of Fatima's `/account` page
      (now `AccountHeader` with the tabs): tell her.
- [x] **Demo seed** (`w-demo-seed`): ran it (8 categories, 5 places); it now ends by itself. PR to open.
- [x] **New places get their region** (`w-workspace-region`): pushed, PR to open.
- [x] **Search backend** (`w-place-search`): pushed, PR to open first.
- [x] **Home and search pages** (`w-home-search-pages`): pushed. Open after `w-place-search` is merged. Waiting for Wouroud's view of the new search bar.
- [x] **Guest MCP** (F6, `w-guest-mcp`, on top of `w-place-search`): pushed. Open after `w-place-search` is merged.
- [x] **Host MCP with keys** (F14, `w-host-mcp`, on top of `w-guest-mcp`): pushed. Read tools for rooms, free rooms,
      calendar, bookings, in any of the member's places.
- [x] **Connect AI page** (`w-host-mcp-keys-screen`, on top of `w-host-mcp`): pushed.
- [x] **Host MCP report tools** (`w-host-mcp-report`, on `w-host-mcp` + `w-analytics`): committed, NOT PUSHED.
- [x] **Host MCP OAuth** (`w-host-mcp-oauth`, on `w-host-mcp-keys-screen`): committed, NOT PUSHED. Wouroud: test sign-in
      by hand, then connect from ChatGPT or Claude.ai once deployed (needs an https address).
- [ ] Host MCP actions (bonus).
- [x] **Push notifications** (F19, `w-push-notifications`): pushed. Devices, routes, every booking and team email
      also pushed, service worker shows them.
- [x] **Account notifications tab** (`w-account-notifications`, on top of `w-account-privacy` and
      `w-push-notifications`): pushed. Open after those two are merged.
- [x] **Install the app** (F20, `w-install-app`): committed, NOT PUSHED (GitHub sign-in expired).
- [x] **Analytics backend** (`w-analytics`): committed, NOT PUSHED.
- [x] **Dashboard Today and All my places** (`w-dashboard-today`, on `w-analytics`): committed, NOT PUSHED.
- [x] **Analytics page** (`w-analytics-page`, on `w-dashboard-today`): committed, NOT PUSHED.

## Needs Wouroud

- [ ] **Deployment**: go through Omar's `github-deploy-setup.md` with Wouroud. Never print or copy the SSH private key.
- [ ] Tell Fatima and Omar about the shared pieces I added (ChoiceCards, CheckboxChips, DisclosurePanel,
      `categoryName`, ScrollRail, StatTile, BarChart, `api.delete` with a body).

## To push when GitHub sign-in works again

`git push -u origin <branch>` for each: w-install-app, w-analytics, w-dashboard-today, w-analytics-page, w-host-mcp-report, w-host-mcp-oauth.

## Rules to keep

- Never start the app or Docker; give the commands.
- Never merge anything into `development` myself.
- Commit only when asked; simple messages.
