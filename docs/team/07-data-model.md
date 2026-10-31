# Data model for the new project

The new project uses almost the same database as the reference project. This file lists **only what changes**,
because of the decisions in `06-functional-requirements.md`.

**Status: applied.** Every change below is in `prisma/schema.prisma` and in the migration
`prisma/migrations/20261030000000_three_booking_modes`, which runs after the reference project's migrations. The
diagrams in `docs/erd.md`, `docs/erd-platform.md` and `docs/erd-ai-mcp.md` are made from this schema, so they already
show the new project's tables.

Rule: every table of every feature is in the schema from the start, including the bonus features (experiences,
plans, AI, push notifications). So nobody waits for a table later.

---

## 1. What stays exactly the same

These tables keep the same columns and meaning as in `docs/erd.md`:

- **Sign-in:** `User`, `Session`, `Account`, `Verification`, and the OAuth tables (`OauthClient`, `OauthAccessToken`,
  `OauthRefreshToken`, `OauthConsent`, `OauthResource`, `OauthClientResource`, `OauthClientAssertion`, `Jwks`).
- **Businesses and teams:** `Business` (except the changes in section 2), `Role`, `Membership`, `HostProfile`.
- **Places:** `Room`, `RateOverride`, `Photo`, `StoredImage`, `Category`, `BusinessCategory`.
- **Calendar:** `Occupancy` (except one column, section 2), `CalendarFeed`.
- **Experiences (bonus):** `Offering`, `OfferingSession`.
- **Money:** `Refund`, `Payout`, `PlanPayment`, `WebhookEvent`,
  `WhishSandboxPayment` (the Whish simulator).
- **Guests:** `Favorite`, `Review`.
- **Logs and settings:** `ActivityLog`, `SiteSetting`. (Rate limits live in Redis, not in a table.)
- **AI:** `ApiKey`, `McpAuditLog`, `AiUsage`, `AiChat`, `AiChatMessage`.
- **Push:** `PushSubscription`.

### 1.1 Rules already in the reference schema, kept as they are

These were settled on purpose. Do not undo them, and follow them in every new table or column.

- **Money is `BigInt` minor units.** `…Cents` columns (and `AiUsage.costMicroUsd`) are `BigInt`, because LBP totals
  outgrow a 32-bit int (5 nights at 4,500,000 LBP is 2.25 billion cents). 99.99 is stored as 9999; never use
  `Decimal` or `Float` for money. The client (`src/server/db/client.ts`) reads them back as plain numbers through its
  `moneyAsNumbers` extension, so a new money column must be added there too. Generated types with money are wrapped
  in `MoneyAsNumbers<…>` (`src/lib/money.ts`). Raw SQL sums of money use `::bigint` and `moneyNumber()`.
- **No deposits.** A booking is always paid in full: there is no `depositPercent`, `depositCents` or
  `onlineAmount`. `Business.paymentInstructions` (how to pay the host directly) replaces the old deposit
  instructions.
- **Plans are paid instantly only** (Stripe or Whish). There is no `PlanRequest`, no `PlatformPaymentOption`, no
  receipt upload and no admin approval. `PlanPayment` records who paid (`paidById`) and the months bought; a CHECK
  constraint (`plan_payment_instant_only`) refuses any new method but `STRIPE` or `WHISH`.
- **Platform clashes stay in `Occupancy`.** An Airbnb or Booking.com booking over nights we already sold is saved as
  a normal active `IMPORTED` row with `conflict = true`, not in a separate table and not inactive: it is a real
  guest. The overlap rule (`occupancy_no_overlap`, `WHERE active AND kind <> 'IMPORTED'`) never sees imported rows,
  and `(feedId, externalUid)` is unique so refreshes never make copies.
- **One fact, one place.**
  - Cancellation: the refund rule is the only one. There is no free-text `Business.cancellationPolicy` and no
    `Offering.cancellationHours`.
  - Contact: the numbers guests use are the business's (`Business.whatsapp`, `phone`). `HostProfile` has no phone or
    WhatsApp; the host's own number is `User.phone`.
  - Reviews: one overall `rating` and a comment. No `cleanliness`, `location` or `value`.
- **Push devices:** `PushSubscription.endpoint` is unique (one browser, one row) and `userId` is required. There is
  no `bookingToken`.
- **Indexes:** `(status, holdExpiresAt)` on `Booking` and `SessionBooking` for the expiry jobs, `(businessId, checkIn)`
  on `Booking`, `(businessId, startsAt)` on `OfferingSession`, and GIN indexes on `tags`, `accessibility` and
  `amenities`. `docs/erd.md` ends with the full list.
- **Not in Prisma:** job queues (pg-boss's `pgboss` schema) and rate-limit counters (Redis).

---

## 2. What changes

### 2.1 One booking mode instead of four settings

**Before:** in the reference, `Business` has two settings that together make the booking rules: `bookingMode`
(`REQUEST` or `INSTANT`) and `paymentCollection` (`AT_PLACE` or `ONLINE`). (Deposits are already gone: there is no
`onlineAmount` or `depositPercent`.)

**After:** one setting with the three modes.

```prisma
enum BookingMode {
  AUTOMATIC        // pays online (full amount), confirmed automatically by the payment webhook
  ONLINE_APPROVAL  // pays online (full amount), then the owner confirms or declines
  OFFLINE          // no payment through the platform; the owner confirms or declines by hand
}

model Business {
  // ...
  bookingMode BookingMode @default(OFFLINE)
  holdHours   Int         @default(24) // how long the owner has to answer (modes 2 and 3)
  paymentInstructions String? // kept: how to pay the host in OFFLINE mode
  // removed: paymentCollection
}
```

Remove the `PaymentCollection` enum.

### 2.2 No refund policies: refunds are always full

**Before:** `RefundPolicy` (`FLEXIBLE`, `MODERATE`, `STRICT`, `NON_REFUNDABLE`) on `Business`, `Booking` and
`SessionBooking`.

**After:** every refund of an online payment is full and automatic. Remove the `RefundPolicy` enum and the
`refundPolicy` columns. Pages then say "Online payments are always refunded in full" wherever the reference shows the
refund rule (the place page's "Cancellation", the contact page, the experience page). There is still no free-text
cancellation policy (section 1.1).

Add a record that the owner accepted this rule when choosing an online mode:

```prisma
model Business {
  // ...
  onlineTermsAcceptedAt DateTime? // when the owner accepted "online payments are always refunded in full"
}
```

The app refuses to switch a business to `AUTOMATIC` or `ONLINE_APPROVAL` until this is set.

### 2.3 Bookings: the full amount, and the mode used

**Before:** in the reference, `Booking` has `onlineDueCents` (the full price when paid online, else null) and
`refundPolicy`.

**After:**

```prisma
model Booking {
  // ...
  totalCents    BigInt      // minor units, read as a number (section 1.1)
  bookingMode   BookingMode // copied from the business when the booking is made, so later changes do not affect it
  holdExpiresAt DateTime?   // the 10-minute payment window, or the owner's answer time
  // removed: onlineDueCents, refundPolicy
}
```

A booking is paid online when `bookingMode` is `AUTOMATIC` or `ONLINE_APPROVAL`, and the amount is always
`totalCents`. Make the same change on `SessionBooking` (bonus).

### 2.4 Booking statuses: the new order

The statuses stay the same (`HELD`, `AWAITING_PAYMENT`, `CONFIRMED`, `DECLINED`, `EXPIRED`, `CANCELLED`). Only the
order changes, because the guest now pays **before** the owner decides:

| Mode                     | Steps                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Automatic             | `AWAITING_PAYMENT` (10 minutes) → `CONFIRMED` when paid · or `EXPIRED` if not paid in time                                                                                                          |
| 2. Online, with approval | `AWAITING_PAYMENT` (10 minutes) → `HELD` when paid (waiting for the owner) → `CONFIRMED` or `DECLINED` (full refund) · `EXPIRED` if not paid in time, or if the owner does not answer (full refund) |
| 3. Offline               | `HELD` (waiting for the owner) → `CONFIRMED` or `DECLINED` · `EXPIRED` if the owner does not answer                                                                                                 |

In every mode, `CONFIRMED` can become `CANCELLED` (with a full refund if it was paid online). This is a code change in
`booking-status.ts` and `booking-policy.ts`, not a table change.

### 2.5 Payments: online only

**Before:** `Payment` also stored payments the owner recorded by hand (cash, OMT, bank), with `recordedById` and an
`online` flag.

**After:** `Payment` only stores online payments (Whish or Stripe). Remove `recordedById` and `online`. The methods
for booking payments are only `WHISH` and `STRIPE`. The other methods (`CASH`, `OMT`, `BANK_TRANSFER`, `CRYPTO`,
`OTHER`) stay in the `PaymentMethod` enum only for old plan payments made by hand. Plans are now paid
instantly (Stripe or Whish); `PlanRequest` and `PlatformPaymentOption` are gone, and a CHECK constraint refuses
any new plan payment that is not `STRIPE` or `WHISH`.

### 2.6 Calendar: no Kazderni, and imported nights are not bookings

- `FeedSource` becomes `AIRBNB`, `BOOKING`, `OTHER` (remove `KAZDERNI`). `OTHER` covers any other platform with an
  iCal link, such as Vrbo.
- `Occupancy.source`: remove it. Closed dates (`MANUAL`) only keep a `note`. Imported nights (`IMPORTED`) get their
  source from their `CalendarFeed`.
- Imported nights stay as `Occupancy` rows of kind `IMPORTED`. They block the calendar, but they are not bookings:
  no guest, no money, and they are not counted in the numbers.

### 2.7 Notifications for payments and refunds

No table change. `ActivityLog` already records `payment.online_confirmed`, refunds and expiries, and the bell reads
from it.

### 2.8 Job queues: a `pgboss` schema beside ours

No Prisma change. The worker's queues (`ai`, `notify`, `cron`) live in the same database, in a `pgboss` schema that
pg-boss creates and upgrades itself when it starts. Never add it to `schema.prisma` or write to it with Prisma; use
`src/server/jobs/queue.ts`. Job data holds only ids and plain values. Finished AI jobs are deleted after an hour,
others after a day.

### 2.9 `JobProgress`: the answer while it is written

New table (migration `20261028000100_job_progress`): `jobId` (pg-boss's id, the key), `step` (the tool in use, or
null), `text` (the reply so far), `updatedAt` (indexed, for cleanup). Written by the worker at most every 300 ms,
read by `GET /api/jobs/{jobId}`, deleted when the job ends.

---

## 3. What I checked is not missing

| Feature                                 | Covered by                                                            |
| --------------------------------------- | --------------------------------------------------------------------- |
| The 10-minute payment window            | `Booking.holdExpiresAt` and the housekeeping job (every 5 minutes)    |
| Slow AI work, retried emails, schedules | The `pgboss` schema (pg-boss), not Prisma                             |
| Webhooks applied only once              | `WebhookEvent` (unique on `provider, eventId`)                        |
| Platform clashes shown, never cancelled | `Occupancy.conflict`, the bell, and an email and push to the hosts    |
| Rate limits across servers              | Redis (`REDIS_URL`), not a table                                      |
| A failed automatic refund sent by hand  | `Refund.automatic` and `RefundStatus` (`PENDING` → `DONE`)            |
| Payouts to owners                       | `Payout` (`REQUESTED` → `PAID` or `REJECTED`)                         |
| Commission saved                        | `Business.commissionRateBps` and the confirmed bookings' `totalCents` |
| Email verification                      | `Verification` (Better Auth)                                          |
| Each person's language                  | `User.locale`, `Booking.locale`                                       |
| Contact host choice                     | `HostProfile.contactBy`                                               |
| The bell's "seen" state                 | `User.notificationsSeenAt`                                            |
| Experiences, plans, AI, push (bonus)    | Their tables are kept, so they can be built any time                  |

---

## 4. Summary for the migration

1. `BookingMode`: new values `AUTOMATIC`, `ONLINE_APPROVAL`, `OFFLINE`. Remove `PaymentCollection` and
   `RefundPolicy`.
2. `Business`: remove `paymentCollection` and `refundPolicy`. Add `onlineTermsAcceptedAt`. Keep
   `paymentInstructions`.
3. `Booking` and `SessionBooking`: remove `onlineDueCents` and `refundPolicy`. Add `bookingMode`. Money stays
   `BigInt`.
4. `Payment`: remove `recordedById` and `online`.
5. `FeedSource`: remove `KAZDERNI`. `Occupancy`: remove `source`.
6. Keep everything else, including the EXCLUDE rule against overlapping nights and every rule in section 1.1.
   Deposits, hand-paid plans, the rate-limit table and the duplicate cancellation and contact fields are already
   gone from the reference; do not bring them back.
7. Nothing to migrate for the queues: pg-boss creates its `pgboss` schema when the worker first starts.
8. Add `JobProgress` (live text of queued AI answers).

## 5. Waiting for the database keeper

Approved by Sami after the scope was locked. Not in `prisma/schema.prisma` yet: the database keeper adds them in a
new migration before featured partners (F23) are built. "Near your stay" (F22) needs no change: it reads `Offering.region`, the
map pin and the `OfferingSession` dates that exist.

1. `PartnerKind` enum (restaurant, supermarket, park, museum, and the like), matched by `src/config/partner-kinds.ts`
   with `satisfies`.
2. `PartnerPlace`: a place near guesthouses that is not on the platform. Name, kind, region (a key of
   `src/config/regions.ts`), area, map pin, photo, website link, phone, `isDeleted`, created and updated times. Not
   tied to a business: platform admins manage it. Indexed by region.
3. `Sponsorship`: the dates during which a partner place, or an experience or service (`Offering`), is sponsored.
   Exactly one of `partnerPlaceId` and `offeringId` (a `CHECK`), `startsOn` and `endsOn` as dates with `endsOn` after
   `startsOn` (a `CHECK`), who created it, `isDeleted`. Indexed by dates.
4. How a sponsor pays is not decided yet. If it is paid through the platform, it is paid instantly with Stripe or
   Whish like plans, and its money is `BigInt` minor units with a line in `moneyAsNumbers`.
5. After the migration: `pnpm exec prisma generate`, `pnpm docs`, and update `docs/erd-explained.md`.
