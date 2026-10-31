# How we split the work (Checkpoint 1)

Three areas, one owner each. Every file has exactly one owner, so we can work at the same time without conflicts.
This covers the work until Checkpoint 1 (Tuesday 3 November): the core flow of `docs/scope-lock.md`, steps 1 to 6,
live on the public URL, on two phones, in English and Arabic.

How the code is built (layers, rules, contracts) is in `02-architecture-and-features.md`; where each file goes is in
`05-project-structure.md`. This file only says **who owns what, and in which order**.

## Why three areas, not four

- **Auth goes with Core.** It is small, and everything depends on it: sign-in, permissions and tenancy (which
  business am I in) must exist before any guest or host feature.
- **The booking bridge has one owner.** It is the riskiest code: no double bookings, payments, refunds. If the guest
  side and the host side both edited `booking-service.ts`, we would conflict every day. Core owns the booking engine;
  the guest and host sides build their screens on its functions, whose shapes are written in `02` Part 14.

## The three areas

### 1. Core: auth, tenancy, the booking engine and payments

Suggested owner: **Wouroud** (the heaviest backend).

| Layer          | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server base    | `src/server/env.ts`, `errors.ts`, `db/client.ts`, `http/*`, `background.ts`, `email/*`, `src/utils/money.ts`, `dates.ts`, `tokens.ts`, `src/server/jobs/*` (queues, worker, schedules), `scripts/dev.ts`                                                                                                                                                                                                                                     |
| Plans          | `src/config/plans.ts`, `billing-service.ts`, `billing-repository.ts`, `api/workspaces/[businessId]/billing/**` (the API; the `/billing` page is Omar's, in the dashboard). Omar's `createRoom` calls `assertPlanAllowsAnother(ctx.businessId, "rooms")`                                                                                                                                                                                      |
| Auth           | `src/server/auth/better-auth.ts`, `permissions.ts`, `tenant-context.ts`, `src/app/api/auth/[...all]/`, `src/lib/auth-client.ts`, `src/config/enums.ts`                                                                                                                                                                                                                                                                                       |
| Auth pages     | `src/app/(auth)/**`, `src/components/account/auth-form.tsx`, `auth-page.tsx`, `password-forms.tsx`, `sign-out-button.tsx`, `create-workspace-form.tsx`, `src/app/home/`                                                                                                                                                                                                                                                                      |
| Accounts       | `onboarding-service.ts`, `account-service.ts`, `business-repository.ts`, `account-repository.ts`, `api/workspaces/route.ts`, `api/me/delete`, `api/me/export`                                                                                                                                                                                                                                                                                |
| Booking engine | `booking-service.ts`, `booking-policy.ts`, `booking-status.ts`, `constraint-errors.ts`, `housekeeping-service.ts`, `booking-repository.ts`, `api/cron/`                                                                                                                                                                                                                                                                                      |
| Payments       | `online-payment-service.ts`, `payment-service.ts`, `whish-simulator-service.ts`, `money-repository.ts`, `payment-repository.ts`, `whish-simulator-repository.ts`, `src/modules/payments/server/whish.ts`, `src/modules/payments/server/stripe.ts`, `api/payments/`, `api/webhooks/`, `api/whish-simulator/`, `api/public/bookings/[token]/checkout/`, `(site)/whish-simulator/`, `components/booking/pay-online.tsx`, `components/payments/` |

Core writes **every function** in `booking-service.ts`, including the read functions the others need
(`listBookings`, `getBookingForGuest`, the guest's trips). They are written first, from the contracts in `02`
Part 14.

### 2. Guest side: the design system, the languages and every public page

Suggested owner: **Fatima** (strongest on screens).

| Layer         | Owns                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Design system | `src/app/globals.css`, `src/app/fonts/`, `src/components/ui/*`, `shell/*`, `site/*`, `theme/*`, `brand/*`, `src/hooks/*`, `src/lib/api-client.ts`, `parent-path.ts`, `src/app/not-found.tsx`, `error.tsx`, `offline/`    |
| Languages     | `src/i18n/request.ts`, `src/app/layout.tsx`, `src/app/actions/locale.ts`, `src/utils/format.ts`, `zoned-time.ts`, the skeleton of the three message files                                                                |
| Public data   | `directory-service.ts`, `directory-repository.ts`, `pricing.ts`, `api/public/places/[slug]/rooms/**` (quote, availability)                                                                                               |
| Guest pages   | `src/app/(site)/**` (home, search, `p/[slug]/**`, the book page, `b/[token]`, `account/**`), `components/place/*`, `listing/*`, `browse/*`, `booking/*` (except `pay-online.tsx`), `components/account/account-tabs.tsx` |
| Guest routes  | `api/public/places/[slug]/bookings/`, `api/public/bookings/[token]/` (read), `api/me/bookings/`: thin routes that call Core's booking functions                                                                          |
| Lists         | `src/config/listing.ts`, `amenities.ts`, `regions.ts`, `category-icons.ts`, `appearance.ts`, `brand.ts` (Core started `brand.ts` and the language part of `appearance.ts` for the sign-in emails: build on them)         |

### 3. Host side: the dashboard, the demo data and the live site

Owner: **Omar** (he owns the deployment).

| Layer       | Owns                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard   | `src/app/dashboard/**` (layout, rooms, photos, place, settings, bookings), `src/components/dashboard/*`, `nav-items.ts`                                                                  |
| Host data   | `room-service.ts`, `room-repository.ts`, `photo-service.ts`, `photo-repository.ts`, `settings-service.ts`, `calendar-service.ts`, `calendar-repository.ts` (closed dates), `api/images/` |
| Host routes | `api/workspaces/[businessId]/**` (rooms, photos, settings, bookings, blocks). The bookings routes call Core's functions                                                                  |
| Demo data   | `prisma/seed.ts`, the `db:seed` script                                                                                                                                                   |
| Deployment  | `Dockerfile`, `docker-compose.prod.yml`, `.github/workflows/*`, DigitalOcean, Cloudflare R2                                                                                              |

## The rules that prevent conflicts

1. **One owner per file.** If you need something in another person's file, ask on Discord or write it in your pull
   request. Never edit it yourself.
2. **Services belong to their area owner. A route is thin and belongs to whoever builds the screen that uses it.**
   The host's bookings route calls Core's `confirmBooking`, but the route file is Omar's.
3. **Build against the contracts.** The function shapes for the booking engine, tenancy and permissions are in `02`
   Part 14. Write your code against them before they are merged, and connect the last line when they merge. Never
   write a fake version.
4. **The shared files are created on day 1, with one section per area:**
   - The input checks live in each module's `schemas.ts`, so they are no longer shared. Only the small pieces
     every module reuses are in `src/lib/schemas.ts` (Core owns it): ask before changing one.
   - The message files `messages/en.json`, `ar.json`, `ar-LB.json` (Fatima creates them): the same top-level groups
     as the reference project, so the screens copied from it keep working unchanged, and the same keys in all three
     files. Each group has one owner (the table below). Add only under your own groups; for a text in someone
     else's group, ask them.
   - `docs/openapi.json`: add only the paths under your own prefixes. On a conflict, keep both sides and run
     `pnpm run docs`.
5. **No database changes.** The schema is complete for Checkpoint 1. A change goes through the database keeper, in
   its own pull request first.
6. **Never reformat or "tidy" files you don't own.** Run Prettier on your own files only.
7. **Small pull requests, one feature each: the API first, then its screens.** The API is checked by hand in Postman
   or Swagger before review (`04` Part 2). Branch from `development`, open the pull request into `development`, and pull `development` every
   morning. `main` only changes when we release (`README.md`, "GitHub").

## Who owns each group of the message files

Each group belongs to whoever owns the screens that use it.

| Owner                     | Groups                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fatima** (guest side)   | `common`, `nav`, `footer`, `shell`, `profile`, `pagination`, `appearance`, `dates`, `errors`, `pwa`, `notifications`, `home`, `host`, `search`, `searchPage`, `filters`, `listing`, `listingSummary`, `regions`, `place`, `placePage`, `photoTour`, `meetHost`, `share`, `contactHost`, `thingsToKnow`, `privacy`, `booking`, `bookPage`, `confirmation`, `account` |
| **Wouroud** (Core)        | `auth`, `invitation`, `oauth`, `permissions`, `serverErrors`, `refundPolicy`, `whishSim`, and `confirmation.pay` (the pay buttons on the booking page)                                                                                                                                                                                                              |
| **Omar** (host side)      | `dashboard`, `confirm`, `hostProfile`, `overviewAll`, `analytics`, `plans` (the `/billing` page)                                                                                                                                                                                                                                                                    |
| Whoever builds it (bonus) | `offering`, `offeringPage` (experiences and services), `admin` (the admin area), `assistant` (the AI assistants, last bonus)                                                                                                                                                                                                                                        |

- `common` holds words every screen uses (Save, Cancel…). Ask Fatima before adding to it.
- `notifications` is the bell. Its frame is Fatima's, but each new bell entry (`notifications.actions.<action>`) is
  added by whoever adds the event that logs it, as part of the four steps in `CLAUDE.md`.
- A new group goes in this table in the same pull request that adds it.

## The order for Checkpoint 1

| Day            | Core                                                                                                                             | Guest                                                                                                                                                                             | Host (Omar)                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Sat 31 Oct** | The server base, Better Auth, permissions, `enums.ts`, the `schemas.ts` skeleton. The booking contracts written in code first.   | The design system: `Button`, `Field`, `FormError`, `PageHeader`, `Panel` in a first small pull request, then the frames and `api-client`. The languages and the message skeleton. | Deployment: Docker, DigitalOcean, the CI deploy job, R2, an empty site live. Start the seed.                        |
| **Sun 1 Nov**  | Tenancy (`tenantRoute`), the auth pages, creating a place, then the booking engine (`requestBooking`, decisions, `expireHolds`). | The public read API (place, quote, availability), the place page, the booking box.                                                                                                | The dashboard layout (on `AppShell`), the rooms, prices, photos and settings APIs, the full seed.                   |
| **Mon 2 Nov**  | Payments: the Whish simulator, Stripe, webhooks, full refunds.                                                                   | The book page, the booking page `/b/[token]`, My trips, on Core's routes.                                                                                                         | The bookings list, decisions and closed-dates APIs, then the screens for rooms, photos and settings.                |
| **Tue 3 Nov**  | The pay buttons on the booking page; fixes.                                                                                      | Arabic and phone polish on every guest page.                                                                                                                                      | The bookings and decisions screens. **Afternoon:** all three of us run the core flow on two phones on the live URL. |

Two points need care:

- **Fatima's first small pull request must merge on Saturday morning.** Every screen depends on those five
  components.
- **Core's booking functions must exist by Sunday evening.** Fatima's book page and Omar's bookings page call them.
  Until then, both build everything around those calls.
