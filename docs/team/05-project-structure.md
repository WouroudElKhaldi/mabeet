# Project structure

Mabeet is a **modular monolith**: one Next.js app, one database, one deploy, split into feature modules. A feature
lives in one folder, `src/modules/<name>/`, from its database queries to its screens and tests. The code every
feature shares (settings, errors, the database client, sign-in and tenancy, the route wrappers, jobs, email) is
the **shared kernel** in `src/server/`, and it never depends on a feature.

Put new code in the folder whose note matches it. If no folder fits, ask in your pull request before you add a
folder or a module. Generated folders (`node_modules`, `.next`) and private notes are not listed.

## The shape of a module

```
src/modules/bookings/
  index.ts                  # door for code that may run in the browser: input checks, types, screens
  server.ts                 # door for server code: the services routes and other modules may call
  schemas.ts                # this module's Zod input checks
  config.ts                 # this module's fixed lists, when only it uses them
  server/
    booking-service.ts      # rules, permissions, transactions
    booking-repository.ts   # database queries (private to the module)
    booking-notifications.ts  # its notify jobs (emails, push)
  components/               # its screens and parts ("use client" only where needed)
  hooks/                    # hooks only its screens use
  tests/
    booking-service.test.ts               # unit test
    booking-race.integration.test.ts      # needs the database
```

A module creates only the folders it needs. Its rules:

1. **Two doors.** Outside code imports `@/modules/<name>` or `@/modules/<name>/server`, nothing else. Repositories
   and every other inner file are private. Inside the module, files import each other by relative path.
2. **No circles.** If `bookings` calls `payments`, `payments` never calls `bookings` back; one side becomes a job or
   is called by a third module. The order today: `team` calls `accounts`, `audit` and `billing`; `billing` calls
   `accounts`, `payments` and `audit`; `housekeeping` calls `billing`. Decided for what comes next: `bookings` calls
   `payments` and `calendar-sync`, and neither of them ever calls `bookings` (rule 4 says how).
3. **One transaction across modules passes `tx`.** A public function that writes takes an optional `tx`, so a caller
   in another module can commit both changes together.
4. **What must be one transaction stays in one module.** No double booking needs the availability check, the hold
   and the lock in the same transaction (`lockActiveRoom`, the EXCLUDE constraint). So `bookings` owns reservations,
   availability, holds, closed dates, session bookings and the night locks. Two consequences:
   - A booking's payment and refund rows change with its status (paid confirms it in mode 1, a decline or a
     cancellation refunds it), so `bookings` writes them in the same transaction. `payments` holds what both
     bookings and plans call: the Whish and Stripe clients, the Whish simulator, payouts and the lock on a business's
     money (`lockBusinessMoney`).
   - `calendar-sync` manages the feed links, downloads and reads them, and builds the export file. It never calls
     `bookings`: `bookings` calls it (the 15-minute sync, "Sync now", the re-read before confirming) and writes the
     `IMPORTED` rows itself.
5. **A repository reads its own module's tables.** For another module's data, call that module's `server.ts`. Two
   exceptions, both reads or one transaction that cannot be split: a count against a plan's limits (billing counts
   rooms, experiences and members), and closing an account (`softDeleteUser` in `accounts` marks everything that
   holds the person's data in one transaction, and "Download my data" reads it). The kernel's one repository,
   `src/server/auth/membership-repository.ts`, reads memberships because the route wrapper needs them before any
   module runs.

ESLint enforces the import side of these rules, repositories included: a deep import into a module, a relative path
climbing into another module, or the kernel importing a module fails `pnpm lint`.

## The modules

| Module          | Owns                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts`      | User accounts: export and delete my data, accounts created from an invitation, platform admins                                                                          |
| `workspaces`    | Creating a place, its settings, the host profile, the place's own site                                                                                                  |
| `team`          | Roles, members, invitations, and the team's emails                                                                                                                      |
| `rooms`         | Rooms, photos, rates and price calculation (`pricing.ts`)                                                                                                               |
| `offerings`     | Experiences and services, and their sessions                                                                                                                            |
| `bookings`      | The booking engine: reservations, availability, holds, decisions, closed dates, session bookings, locks, a booking's payments and full refunds, writing imported nights |
| `calendar-sync` | Airbnb and Booking.com calendar links: managing, downloading and reading feeds, building the export                                                                     |
| `payments`      | The Whish and Stripe clients, the Whish simulator, payouts, the lock on a business's money                                                                              |
| `billing`       | Plans: Stripe subscriptions, Whish plan months, plan limits (`assertPlanAllowsAnother`)                                                                                 |
| `directory`     | The public side: search, place pages, quotes, favourites, contacting a place                                                                                            |
| `reviews`       | Reviews and host replies                                                                                                                                                |
| `analytics`     | Revenue, occupancy and reports                                                                                                                                          |
| `notifications` | The bell feed and push devices (each module sends its own emails and push through jobs)                                                                                 |
| `assistant`     | The AI: tools, the tool runner, chat, MCP, API keys, AI usage                                                                                                           |
| `audit`         | The audit log and each person's timeline (`recordAction`, `recordPersonAndBusiness`)                                                                                    |
| `housekeeping`  | The scheduled tidy-up: expiring holds and plan months                                                                                                                   |
| `admin`         | The platform admin area                                                                                                                                                 |
| `partners`      | Partner businesses                                                                                                                                                      |

`accounts`, `workspaces`, `team`, `billing`, `payments`, `audit` and `housekeeping` exist today. The others are
created by the first feature that needs them, in this shape.

## Where each kind of file goes

| You are writing…                                    | Put it in                                                                                             | Never in                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A page or an API route                              | `src/app/**` (`page.tsx`, `route.ts`), thin: it calls one module's `server.ts`                        | a file with business rules or database calls     |
| A business rule, a permission check, a transaction  | `src/modules/<name>/server/<area>-service.ts`, exported through the module's `server.ts`              | routes, components, repositories                 |
| A database query                                    | `src/modules/<name>/server/<area>-repository.ts`                                                      | services (they pass `prisma` or `tx` in), routes |
| An input check for an API route                     | `src/modules/<name>/schemas.ts`, exported through `index.ts`; shared pieces in `src/lib/schemas.ts`   | inside the route                                 |
| A list of allowed values (statuses, methods, plans) | `src/config/*.ts`, checked with `satisfies` against the Prisma enum                                   | typed by hand in many places                     |
| A colour, radius or shadow                          | a token in `src/app/globals.css` (`@theme`)                                                           | a hex colour or `bg-[#...]` in a component       |
| A screen or part used by one feature                | `src/modules/<name>/components/`                                                                      | `src/components/`                                |
| A part of the screen used in many places            | `src/components/ui/`                                                                                  | copied into each screen                          |
| A hook                                              | `src/modules/<name>/hooks/` for one feature, `src/hooks/` when many screens use it                    | inside a component file                          |
| A small pure helper (dates, money, slugs)           | `src/utils/`                                                                                          | a service or a component                         |
| Setup of a library both sides use                   | `src/lib/` (shared Zod checks, `api-client`, `auth-client`)                                           | `src/utils/`                                     |
| An AI tool                                          | `src/modules/assistant/server/team-tools.ts` or `guest-tools.ts`, calling a module's `server.ts`      | its own database code                            |
| Slow or must-happen work (AI, email, schedules)     | a job: `defineJob(...)` in its module, the file listed in `src/server/jobs/registry.ts`               | awaited on the request path                      |
| An email or push                                    | a notify job in the module that owns the event: `src/modules/<name>/server/<name>-notifications.ts`   | a shared notification file                       |
| Text on screen                                      | `messages/en.json`, `ar.json`, `ar-LB.json` (same key in all three), under the module's key           | written inside a component                       |
| A test of a module                                  | `src/modules/<name>/tests/<area>.test.ts`, or `<area>.integration.test.ts` when it needs the database | another module's folder                          |
| A test of the shared kernel or across modules       | `tests/unit/<area>.test.ts` or `tests/integration/<area>.test.ts`                                     | next to the code file                            |

Names:

- File names use `kebab-case`, for example `booking-service.ts`. Module folders too, for example `calendar-sync`.
- Components use `PascalCase`, for example `BookingWidget`.
- Services and repositories export plain functions named after what they do, for example `requestBooking` or
  `findBookingByReference`.
- Constants use `UPPER_SNAKE_CASE`, for example `MAX_NIGHTS`.

## What each folder is for

| Folder                            | What goes there                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/`              | The checks that run on every pull request, the deploy, and the scheduled jobs (until the worker runs them)                          |
| `docs/`                           | Documents for reviewers: architecture, requirements, data model, database diagram, API contract                                     |
| `messages/`                       | All text on screen, in English, Arabic and Lebanese Arabic. Every key must be in all three (a test checks)                          |
| `prisma/`                         | The database tables, the migrations (including hand-written database rules), and the demo data                                      |
| `prisma/migrations/`              | Never edit a migration after it is merged. Add a new one                                                                            |
| `public/`                         | Fixed files: service worker, icons, images                                                                                          |
| `scripts/`                        | Developer tools: local database, document generators, smoke tests                                                                   |
| `src/app/`                        | Pages and API routes (Next.js). They read input, call a module's service, and answer. No rules, no database                         |
| `src/app/api/`                    | The API. Every route uses route() or tenantRoute() and checks its input with a Zod schema                                           |
| `src/app/(site)/`                 | The public website: home, search, place pages, booking, guest account                                                               |
| `src/app/(auth)/`                 | Sign in, sign up, reset password                                                                                                    |
| `src/app/dashboard/[businessId]/` | The owner and staff dashboard, one folder per section. loading.tsx is the loading screen                                            |
| `src/app/admin/`                  | The platform admin area                                                                                                             |
| `src/modules/`                    | The feature modules (see "The modules"). Each holds its server code, input checks, screens and tests                                |
| `src/components/ui/`              | The design system: Button, Field, LabeledControl, FormError, dialogs, skeletons, shared class names                                 |
| `src/components/shell/`           | The app frame: side menu (`nav-items.ts`), top bar, page header, notification bell, loading screens                                 |
| `src/config/`                     | Fixed lists and settings used by server and screens (statuses, plans, permissions, listing words, brand)                            |
| `src/hooks/`                      | Hooks many screens share: useAction, useRedirectAction, useStoredChoice, useConfirm                                                 |
| `src/lib/`                        | Library setup both sides use: the shared Zod checks (`schemas.ts`), the API client, the auth client                                 |
| `src/utils/`                      | Small pure helpers usable anywhere: dates, money format and `MoneyAsNumbers`, tokens, slugs, sign-in links                          |
| `src/server/`                     | The shared kernel: server code only, no business rules, never imports a module. Screens import it only with `import type`           |
| `src/server/auth/`                | Sign-in setup (Better Auth), TenantContext, resolving the acting member (`resolve-context.ts`, with its `membership-repository.ts`) |
| `src/server/http/`                | Route wrappers, error answers, rate limits (Redis), page sign-in helpers                                                            |
| `src/server/jobs/`                | Queues and the worker: `defineJob`, answer-now-or-queue, `registry.ts` (every module's job file), `worker.ts`                       |
| `src/server/email/`               | Sending emails, the email template, the sign-in emails, the helpers every notice shares                                             |
| `src/server/push/`                | Sending push notifications                                                                                                          |
| `src/server/db/`                  | The Prisma client (money read as numbers), transactions (Tx), database error helpers (`constraint-errors.ts`)                       |
| `tests/unit/`                     | Fast tests of the shared kernel, with no database                                                                                   |
| `tests/integration/`              | Database tests of the kernel and across modules (isolation, transactions, queue), and the shared test helpers                       |

Tests in a module import the shared helpers as `@tests/integration/helpers`.

## Reading the reference project's paths

The file list below is the reference project, which was built in layers (`src/server/services/`,
`src/server/repositories/`, `src/components/<area>/`). When a document or the reference names one of those paths,
this is where it goes here:

| Reference path                                                                                         | Here                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/server/services/<area>-service.ts`, `src/server/repositories/<area>-repository.ts`                | `src/modules/<module>/server/`, the module from "The modules"                                  |
| `src/server/validation/schemas.ts`                                                                     | each module's `schemas.ts`; the shared pieces in `src/lib/schemas.ts`                          |
| `src/server/services/notification-service.ts`                                                          | each module's `<module>-notifications.ts`; sign-in emails in `src/server/email/auth-emails.ts` |
| `src/server/services/constraint-errors.ts`                                                             | `src/server/db/constraint-errors.ts`                                                           |
| `src/server/services/audit.ts`                                                                         | `src/modules/audit/server/audit.ts`                                                            |
| `src/server/auth/permissions.ts`                                                                       | `src/config/permissions.ts`                                                                    |
| `src/server/ai/*`, `src/server/auth/mcp-token.ts`, `src/server/jobs/ai-jobs.ts`                        | `src/modules/assistant/server/`                                                                |
| `src/server/ical/*`                                                                                    | `src/modules/calendar-sync/server/`                                                            |
| `src/server/payments/whish.ts`                                                                         | `src/modules/payments/server/whish.ts`                                                         |
| `src/server/billing/stripe.ts`                                                                         | `src/modules/payments/server/stripe.ts`                                                        |
| `src/server/jobs/cron-jobs.ts`                                                                         | `src/modules/housekeeping/server/housekeeping-jobs.ts`                                         |
| `src/lib/dates.ts`, `money.ts`, `format.ts`, `tokens.ts`, `slug.ts`, `zoned-time.ts`, `parent-path.ts` | `src/utils/`                                                                                   |
| `src/components/<area>/*` (place, booking, dashboard editors, assistant…)                              | `src/modules/<module>/components/`                                                             |
| A feature's `tests/unit/<area>.test.ts` or `tests/integration/<area>.test.ts`                          | `src/modules/<module>/tests/` (`.integration.test.ts` when it needs the database)              |

## All files of the reference project (592)

```
.env.example
.gitattributes
.github/
  workflows/
    ci.yml
    scheduled-jobs.yml
.dockerignore
.gitignore
.prettierignore
.prettierrc.json
README.md
Dockerfile
docker-compose.prod.yml
docker-compose.yml
docs/
  architecture.md
  data-model.md
  erd-ai-mcp.md
  erd-platform.md
  erd.md
  functional-requirements.md
  non-functional-requirements.md
  openapi.json
  requirements-matrix.md
  team/
    02-architecture-and-features.md
    03-claude-prompt-guide.md
    04-test-plan.md
    05-project-structure.md
    06-functional-requirements.md
    07-data-model.md
    08-design-system-and-pages.md
    README.md
eslint.config.mjs
knip.json
messages/
  ar-LB.json
  ar.json
  en.json
next.config.ts
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
postcss.config.mjs
prisma/
  migrations/
    20261022000000_init/
      migration.sql
    20261022000100_occupancy_no_overlap/
      migration.sql
    20261022000200_site_settings/
      migration.sql
    20261022000300_listing_types_and_sessions/
      migration.sql
    20261022000400_stored_images/
      migration.sql
    20261022000500_rate_limit_windows/
      migration.sql
    20261022000600_offering_reviews/
      migration.sql
    20261022000700_ai_usage/
      migration.sql
    20261022000800_booking_locale/
      migration.sql
    20261022000900_plans/
      migration.sql
    20261022001000_oauth_mcp/
      migration.sql
    20261022001100_push_subscriptions/
      migration.sql
    20261022001200_payment_positive_amount/
      migration.sql
    20261023000000_online_payments/
      migration.sql
    20261023000100_seats_awaiting_payment/
      migration.sql
    20261023000200_host_profiles/
      migration.sql
    20261023000300_notifications_seen/
      migration.sql
    20261023000400_whole_place_and_photo_areas/
      migration.sql
    20261023000500_ai_chats/
      migration.sql
    20261023000600_manual_plan_payments/
      migration.sql
    20261023000700_host_contact/
      migration.sql
    20261028000100_job_progress/
      migration.sql
    migration_lock.toml
  schema.prisma
  seed-history.ts
  seed-offerings.ts
  seed.ts
public/
  sw.js
scripts/
  dev.ts
  edge-cases.ts
  erd.ts
  lib/
    e2e.ts
  local-db.ts
  openapi.ts
  payments.ts
  push-keys.ts
  smoke.ts
src/
  app/
    (auth)/
      forgot-password/
        page.tsx
      layout.tsx
      oauth/
        consent/
          page.tsx
        workspace/
          page.tsx
      reset-password/
        page.tsx
      sign-in/
        page.tsx
      sign-up/
        page.tsx
    (site)/
      account/
        activity/
          page.tsx
        favorites/
          page.tsx
        layout.tsx
        loading.tsx
        notifications/
          page.tsx
        page.tsx
        privacy/
          page.tsx
      assistant/
        page.tsx
      b/
        [token]/
          loading.tsx
          page.tsx
      host/
        page.tsx
      layout.tsx
      loading.tsx
      o/
        [slug]/
          loading.tsx
          page.tsx
          photos/
            page.tsx
      p/
        [slug]/
          book/
            loading.tsx
            page.tsx
          contact/
            page.tsx
          loading.tsx
          page.tsx
          photos/
            page.tsx
      page.tsx
      pricing/
        page.tsx
      privacy/
        page.tsx
      search/
        page.tsx
      use-with-ai/
        page.tsx
      whish-simulator/
        pay/
          [code]/
            page.tsx
    .well-known/
      oauth-authorization-server/
        api/
          auth/
            route.ts
        route.ts
      oauth-protected-resource/
        api/
          mcp/
            route.ts
        route.ts
    actions/
      favorites.ts
      locale.ts
    admin/
      appearance/
        loading.tsx
        page.tsx
      categories/
        loading.tsx
        page.tsx
      health/
        loading.tsx
        page.tsx
      hosts/
        [userId]/
          loading.tsx
          page.tsx
        loading.tsx
        page.tsx
      layout.tsx
      loading.tsx
      money/
        loading.tsx
        page.tsx
      notifications/
        loading.tsx
        page.tsx
      page.tsx
      partners/
        loading.tsx
        page.tsx
      profile/
        loading.tsx
        page.tsx
      users/
        loading.tsx
        page.tsx
    api/
      admin/
        businesses/
          [businessId]/
            route.ts
        categories/
          [slug]/
            route.ts
          route.ts
        notifications/
          route.ts
        partners/
          [partnerId]/
            route.ts
          route.ts
        payouts/
          [payoutId]/
            route.ts
        refunds/
          [refundId]/
            route.ts
        site/
          route.ts
      assistant/
        route.ts
      auth/
        [...all]/
          route.ts
      cron/
        expire-holds/
          route.ts
        sync-feeds/
          route.ts
      ical/
        [token]/
          route.ts
      images/
        [imageId]/
          route.ts
      jobs/
        [jobId]/
          route.ts
      mcp/
        guest/
          route.ts
        route.ts
      me/
        bookings/
          route.ts
        chats/
          [chatId]/
            route.ts
          route.ts
        delete/
          route.ts
        export/
          route.ts
        profile/
          route.ts
        push/
          route.ts
        reviews/
          route.ts
      oauth/
        workspace/
          route.ts
      payments/
        whish/
          callback/
            route.ts
      public/
        bookings/
          [token]/
            cancel/
              route.ts
            checkout/
              route.ts
            push/
              route.ts
            route.ts
        experiences/
          [slug]/
            bookings/
              route.ts
        places/
          [slug]/
            bookings/
              route.ts
            messages/
              route.ts
            nearby/
              route.ts
            rooms/
              [roomId]/
                availability/
                  route.ts
                quote/
                  route.ts
      webhooks/
        stripe/
          route.ts
      whish-simulator/
        pay/
          [code]/
            route.ts
        payment/
          collect/
            status/
              route.ts
          whish/
            refund/
              route.ts
            route.ts
      workspaces/
        [businessId]/
          analytics/
            report/
              route.ts
            route.ts
          assistant/
            actions/
              route.ts
            chats/
              [chatId]/
                route.ts
              route.ts
            route.ts
          billing/
            checkout/
              route.ts
            portal/
              route.ts
              route.ts
            whish/
              route.ts
          blocks/
            [blockId]/
              route.ts
            route.ts
          bookings/
            [bookingId]/
              [action]/
                route.ts
              payments/
                route.ts
              route.ts
            route.ts
          calendar/
            route.ts
          feeds/
            [feedId]/
              route.ts
              sync/
                route.ts
            route.ts
          host-profile/
            route.ts
          keys/
            [keyId]/
              route.ts
            route.ts
          members/
            [membershipId]/
              route.ts
            route.ts
          notifications/
            route.ts
          offerings/
            [offeringId]/
              route.ts
              sessions/
                route.ts
            route.ts
          payouts/
            route.ts
          photos/
            [photoId]/
              route.ts
            route.ts
          reviews/
            [reviewId]/
              route.ts
          roles/
            [roleId]/
              route.ts
            route.ts
          rooms/
            [roomId]/
              prices/
                route.ts
              route.ts
            route.ts
          session-bookings/
            [bookingId]/
              [action]/
                route.ts
              payments/
                route.ts
          sessions/
            [sessionId]/
              route.ts
          settings/
            route.ts
        route.ts
    apple-icon.tsx
    dashboard/
      [businessId]/
        analytics/
          loading.tsx
          page.tsx
        assistant/
          loading.tsx
          page.tsx
        billing/
          loading.tsx
          page.tsx
        bookings/
          loading.tsx
          page.tsx
        calendar/
          loading.tsx
          page.tsx
        channels/
          loading.tsx
          page.tsx
        keys/
          loading.tsx
          page.tsx
        layout.tsx
        loading.tsx
        notifications/
          loading.tsx
          page.tsx
        offerings/
          loading.tsx
          page.tsx
        page.tsx
        payouts/
          loading.tsx
          page.tsx
        place/
          loading.tsx
          page.tsx
        profile/
          loading.tsx
          page.tsx
        reviews/
          loading.tsx
          page.tsx
        rooms/
          loading.tsx
          page.tsx
        settings/
          loading.tsx
          page.tsx
        team/
          loading.tsx
          page.tsx
      page.tsx
    error.tsx
    favicon.ico
    fonts/
      archivo-100-900.woff2
      inter-100-900.woff2
      kufi-100-900.woff2
      plex-arabic-400.woff2
      plex-arabic-500.woff2
      plex-arabic-600.woff2
      plex-arabic-700.woff2
    globals.css
    home/
      page.tsx
    icons/
      [size]/
        route.tsx
    layout.tsx
    llms.txt/
      route.ts
    manifest.ts
    not-found.tsx
    offline/
      page.tsx
    robots.ts
    sitemap.ts
  components/
    account/
      account-tabs.tsx
      auth-form.tsx
      auth-page.tsx
      create-workspace-form.tsx
      oauth-steps.tsx
      password-forms.tsx
      privacy-controls.tsx
      review-form.tsx
      sign-out-button.tsx
    assistant/
      action-card.tsx
      chat-panel.tsx
      concierge.tsx
      rich-text.tsx
      team-assistant.tsx
    billing/
      billing-buttons.tsx
      plan-cards.tsx
    booking/
      booking-widget.tsx
      guest-cancel-button.tsx
      guest-details-form.tsx
      hold-countdown.tsx
      pay-online.tsx
      price-breakdown.tsx
      use-room-calendar.ts
    brand/
      app-icon.tsx
      arch-window.tsx
      boarding-pass.tsx
      concierge-band.tsx
      direct-receipts.tsx
      postmark.tsx
    browse/
      browse.tsx
      category-bar.tsx
      filters-dialog.tsx
      listing-tabs.tsx
      results-grid.tsx
      scroll-rail.tsx
    dashboard/
      analytics-charts.tsx
      bar-chart.tsx
      booking-actions.tsx
      booking-row.tsx
      business-status-toggle.tsx
      calendar-board.tsx
      calendar-model.ts
      calendar-side-panel.tsx
      category-manager.tsx
      channel-colors.ts
      close-dates-form.tsx
      feed-controls.tsx
      host-profile-form.tsx
      key-manager.tsx
      member-controls.tsx
      nav-items.ts
      offering-editor.tsx
      partner-editor.tsx
      payout-decision.tsx
      payout-request-form.tsx
      photo-manager.tsx
      place-essentials.tsx
      report-generator.tsx
      review-controls.tsx
      role-editor.tsx
      room-editor.tsx
      session-booking-row.tsx
      session-scheduler.tsx
      settings-form.tsx
      site-palette-picker.tsx
      special-prices.tsx
      stat-tile.tsx
      workspace-switcher.tsx
    listing/
      place-map.tsx
      review-list.tsx
      things-to-know.tsx
    offering/
      duration.tsx
      offering-card.tsx
      session-booking-card.tsx
    payments/
      whish-simulator-form.tsx
    place/
      amenity.tsx
      category-icon.tsx
      contact-host-form.tsx
      favorite-button.tsx
      gallery.tsx
      listing-summary.tsx
      meet-host.tsx
      photo-browser.tsx
      photo-tour.tsx
      place-art.tsx
      place-card.tsx
      place-grid.tsx
      share-button.tsx
    pwa/
      install-button.tsx
      install-prompt.ts
      phone-alerts.tsx
      service-worker.tsx
    shell/
      app-shell.tsx
      back-link.tsx
      notification-bell.tsx
      notification-list.tsx
      page-header.tsx
      pagination.tsx
      profile-forms.tsx
      skeletons.tsx
    site/
      header-shell.tsx
      hero-landscape.tsx
      nearby-section.tsx
      search-bar.tsx
      site-footer.tsx
      site-header.tsx
      wordmark.tsx
    theme/
      appearance-menu.tsx
      appearance-provider.tsx
      appearance-script.tsx
    ui/
      button.tsx
      confirm-dialog.tsx
      copy-field.tsx
      date-range-picker.tsx
      field.tsx
      form-error.tsx
      guest-counter.tsx
      loading-status.tsx
      rating.tsx
      sheet-dialog.tsx
      show-all-dialog.tsx
      skeleton.tsx
  config/
    amenities.ts
    appearance.ts
    brand.ts
    category-icons.ts
    enums.ts
    listing.ts
    partner-kinds.ts
    plans.ts
    regions.ts
  global.d.ts
  hooks/
    use-action.ts
    use-redirect-action.ts
    use-stored-choice.ts
  i18n/
    request.ts
  lib/
    api-client.ts
    auth-client.ts
    calendar-grid.ts
    dates.ts
    format.ts
    money.ts
    motion.ts
    parent-path.ts
    privacy.ts
    search-url.ts
    slug.ts
    tokens.ts
    zoned-time.ts
  server/
    ai/
      assistant.ts
      deepseek.ts
      guest-tools.ts
      mcp-server.ts
      output.ts
      run-tool.ts
      team-tools.ts
      tool.ts
    auth/
      better-auth.ts
      mcp-token.ts
      permissions.ts
      tenant-context.ts
    background.ts
    billing/
      stripe.ts
    db/
      client.ts
    email/
      send.ts
      templates.ts
    env.ts
    errors.ts
    http/
      error-i18n.ts
      page.ts
      rate-limit.ts
      route.ts
      session.ts
    ical/
      build-feed.ts
      parse-feed.ts
      safe-fetch.ts
    jobs/
      ai-jobs.ts
      cron-jobs.ts
      progress.ts
      queue.ts
      registry.ts
      worker.ts
    payments/
      whish.ts
    push/
      send.ts
    repositories/
      account-repository.ts
      activity-repository.ts
      admin-repository.ts
      ai-usage-repository.ts
      analytics-repository.ts
      api-key-repository.ts
      billing-repository.ts
      booking-repository.ts
      business-repository.ts
      calendar-repository.ts
      chat-repository.ts
      directory-repository.ts
      favorite-repository.ts
      filters.ts
      host-repository.ts
      job-progress-repository.ts
      money-repository.ts
      notification-repository.ts
      offering-repository.ts
      partner-repository.ts
      payment-repository.ts
      photo-repository.ts
      push-repository.ts
      review-repository.ts
      room-repository.ts
      session-repository.ts
      site-repository.ts
      team-repository.ts
      whish-simulator-repository.ts
    services/
      account-service.ts
      admin-service.ts
      ai-usage-service.ts
      analytics-service.ts
      api-key-service.ts
      assistant-service.ts
      audit.ts
      billing-service.ts
      booking-policy.ts
      booking-service.ts
      booking-status.ts
      calendar-service.ts
      chat-service.ts
      constraint-errors.ts
      contact-service.ts
      directory-service.ts
      favorite-service.ts
      host-service.ts
      housekeeping-service.ts
      mcp-oauth-service.ts
      notification-feed-service.ts
      notification-service.ts
      offering-service.ts
      onboarding-service.ts
      online-payment-service.ts
      partner-service.ts
      payment-service.ts
      payout-service.ts
      photo-service.ts
      pricing.ts
      push-service.ts
      report-service.ts
      review-service.ts
      room-service.ts
      session-booking-service.ts
      settings-service.ts
      site-service.ts
      team-service.ts
      whish-simulator-service.ts
    validation/
      schemas.ts
tests/
  integration/
    analytics.test.ts
    billing.test.ts
    booking-flow.test.ts
    booking-race.test.ts
    calendar.test.ts
    chats.test.ts
    global-setup.ts
    guest-cancel.test.ts
    helpers.ts
    hosts.test.ts
    http.ts
    mcp-isolation.test.ts
    money.test.ts
    nearby.test.ts
    occupancy-constraint.test.ts
    partners.test.ts
    place-search.test.ts
    rate-limit.test.ts
    reviews-and-prices.test.ts
    roles.test.ts
    session-seats.test.ts
    setup-env.ts
    tenant-isolation.test.ts
    whole-place.test.ts
  unit/
    ai-output.test.ts
    ai-usage.test.ts
    assistant.test.ts
    background.test.ts
    concierge-cards.test.ts
    booking-policy.test.ts
    booking-status.test.ts
    dates.test.ts
    deepseek-stream.test.ts
    email.test.ts
    error-i18n.test.ts
    ical.test.ts
    jobs.test.ts
    locale.test.ts
    mcp-server.test.ts
    messages.test.ts
    openapi.test.ts
    parent-path.test.ts
    permissions.test.ts
    photos.test.ts
    pricing.test.ts
    regions.test.ts
    privacy.test.ts
    push.test.ts
    send-email.test.ts
    whish.test.ts
    zoned-time.test.ts
tsconfig.json
vercel.json
vitest.config.mts
```
