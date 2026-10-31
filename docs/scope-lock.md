# Scope: Mabeet

## 1. Team

- Members: Wouroud El Khaldi, Fatima Salami, Omar Antar.
- Who owns what: **still to be decided together.** We split the work into rounds of three tasks built at the same
  time, one per person, each task built by one person from the database to the screen (frontend, backend, AI and
  tests). We split the tasks among ourselves; Omar owns the deployment and the live site. The pitch is done by
  Fatima.

## 2. Product in one sentence

We help Lebanese guesthouses and B&Bs take bookings directly on their own page, paid online in full or
arranged with the host, with one calendar that stays in sync with Booking.com and Airbnb, so they stop paying
the 15 to 18% platform commission on direct guests, stop losing requests in DMs, and are never double-booked.

## 3. The user

- Who exactly uses it: the owner (or front-desk staff) of a small Lebanese guesthouse, 3 to 15 rooms, who gets
  direct requests on Instagram and WhatsApp and may also sell on Booking.com and Airbnb. The guest uses the
  booking page.
- Real businesses you have talked to (name, how many conversations): we have the contact details of about 13
  guesthouse owners, for example Beit El Qamar and Beyt El Jabal in Deir el Qamar, and Casadar Guesthouse in Annaya.
  We already messaged some of them on Instagram: some replied that they already have their own booking system, and
  the others have not replied yet. We are now contacting the rest on WhatsApp. We also spoke with the owner of
  several chalets who is not listed on Airbnb or Booking.com, and he showed interest in using Mabeet.

## 4. The problem today

- How they do it now: direct requests arrive in Instagram and WhatsApp DMs, are confirmed by hand and written in
  a notebook or a spreadsheet, and payments are chased by message. Hosts who also list on Booking.com or Airbnb pay
  commission there and block those calendars by hand after every direct booking.
- What it costs them: 15 to 18% of every platform booking, hours a week answering DMs and blocking calendars, and
  the occasional double booking (an angry guest, a refund, a bad review). No host has shared their own numbers
  yet, so these are estimates from public prices: at Beyt El Jabal (from about $80 a night on Airbnb), every night sold through a platform costs the host $12 to $14.40 in commission, which is $240 to $288 a month for 20
  nights (section 10). We replace this with a real host's numbers as soon as one answers.

## 5. The one core flow

Live on stage, two phones: the guest's and the owner's (both already signed in). The guesthouse uses mode 2
(online payment, owner approval), which is the brief's "booking request confirmed by the owner".

1. The owner adds their guesthouse in their dashboard: the place, its rooms with their price per night, and photos.
   The guesthouse gets its own booking link.
2. The guest opens the guesthouse's booking link (from its Instagram bio) and picks dates. Nights already taken on
   Airbnb and Booking.com show as taken, because those calendars are synced.
3. The guest sees the price per night and the total, enters name and phone, and pays the full amount online with
   Whish or a card. The room is held for them at once.
4. A second guest tries the same night and is refused on the spot: the database itself will not store two stays on
   one room night.
5. Whish or Stripe confirms the payment (webhook). The owner gets the request on their phone. The app re-reads the
   Airbnb calendar, and the owner confirms.
6. The guest's confirmation page shows "confirmed", and the night is now closed on Airbnb and Booking.com too,
   through our calendar link.

How the platform handles money (shown on one screen, not run live):

- Each guesthouse chooses one of three modes: **automatic** (pays online in full, confirmed automatically by the
  payment webhook), **online with approval** (pays online in full, the owner confirms), or **offline** (no payment
  through the platform, the owner confirms by hand).
- Every online payment goes to the platform's Whish or Stripe account, always for the full amount. If no payment
  arrives within 10 minutes, the booking is cancelled and the room is free again.
- Every refund of an online payment is full and automatic. If the owner does not answer in time, the booking
  expires and the guest is refunded in full.
- The owner sees what is owed to them and requests a payout to their Whish number or bank account (IBAN). A
  platform admin sends it by hand and marks it paid.
- The platform takes no commission; it earns only from host plans and sponsored listings. Offline payments are between the owner and the
  guest (written in the payment policy).

## 6. Where the AI fits

The AI is not part of the core flow on stage. It is a bonus, and the first one we build is MCP: the person's own AI
app (Claude, ChatGPT, Cursor, Codex or any MCP client) connects to our tools. Both MCPs call the same services and
permission checks as the website, so they can never do more than the person behind them:

- **Guests:** a public guest MCP. It searches places and checks dates and prices. Always read-only: it links to the
  booking page and never books. A page on the website explains what MCP is, why and how to use it, and shows the
  guest MCP address to copy.
- **Owners and staff:** a host MCP, connected with a personal key or by signing in. The first version only reads
  and reports: free rooms, bookings, revenue, commission saved, and the numbers for a report over a period. After
  it, a few actions the person's role allows: cancel a booking, close or reopen dates, confirm or decline a request.

- What the model does: understands the person's question and chooses which of our tools to call, with which
  details. The model runs in the person's AI app, not on our servers. It decides nothing about the business itself:
  the tools do the work.
- What goes in, what comes out: the tool's checked input goes in; our database's figures come out, already
  formatted, from the same services as the dashboard.
- How we check the output: every tool's input is validated with a schema, and runs the same permission and tenant
  checks as the dashboard. A key or token reaches only the businesses its person belongs to. Write tools are marked
  as changing data, so the AI app asks the person first, and read-only keys never see them. Text written by guests
  is marked as data, never instructions. Every tool call is logged, and every MCP route is rate limited.
- What happens when the model is wrong: a wrong call fails the tool's own checks (unknown booking, dates already
  taken, a room name that fits two rooms) and the person sees why.

Our own model (DeepSeek), for a travel assistant on the website, an assistant in the dashboard and written AI
reports, is the last bonus, built only if time is left.

## 7. Tech stack and hosting

- Stack: Next.js 16 (route handlers in TypeScript), Prisma and PostgreSQL (an EXCLUDE constraint refuses
  overlapping stays), Better Auth (owner and staff roles), Zod validation on every route, MCP for AI apps, iCal
  import and export, Whish (simulator until merchant keys) and Stripe test mode, Tailwind, English and Arabic from
  the first day.
- Where it will be deployed: DigitalOcean, with Docker, deployed by GitHub Actions only after types, lint and all
  tests pass.
- Live URL: our name is now **Mabeet** (تفضّل). We have not bought the domain yet. The site will be live by
  Tuesday 3 November at midnight, before Checkpoint 1. When we buy the domain, we point it at the same app; nothing
  else changes.

## 8. Must work on stage (max 5)

1. The guest book a guesthouse and pays the full amount online, the owner confirms, and the guest gets the confirmation page.
2. The second guest for the same room night is refused (zero double bookings).
3. Airbnb and Booking.com nights block the booking page, and our bookings close the night on their side.
4. The dashboard shows direct bookings and commission saved.

## 9. Cut list (not building before Demo Day)

Not building at all: bookings from Airbnb or Booking.com inside our system (we only import their taken nights to
block the calendar), recording payments made outside the platform (offline mode is between the owner and the
guest), Kazderni (no API or calendar link), automatic payouts, automatic pricing,
in-app chat, a native app, booking through an AI (the guest's AI only searches and links to the booking page).

Bonus, built after the must-haves work, in this order: the host and guest MCP, read-only (Claude, ChatGPT, Cursor,
Codex); host plans paid instantly with Stripe or Whish; experiences and services; things to do near your stay
(experiences and services in the same area during the guest's nights); reviews and favourites; push notifications;
installing the app; the admin area; featured partners and sponsored listings (restaurants, supermarkets, parks,
museums and sponsored experiences, shown near the guest's stay and marked "Sponsored"); a few host actions through
the MCP (cancel a booking, close or reopen dates, confirm or decline a request); and last, our own model (DeepSeek): the assistant in the dashboard, the
travel assistant on the website, AI reports, and answers shown word by word.

## 10. The outcome number

Estimate from public prices (to confirm with the host): Beyt El Jabal in Deir el Qamar, 4 suites on Airbnb, from
about $80 a night with breakfast. If 10 bookings a month of 2 nights move from Airbnb or Booking.com to direct, that
is 20 nights × $80 = $1,600 a month. At 15 to 18% commission, **the host keeps $240 to $288 a month, about $2,900 to
$3,450 a year**, with zero double bookings. The dashboard computes this from the owner's own commission rate.

## 11. Biggest risk

- What could stop the demo from working: venue Wi-Fi; Airbnb refreshing our calendar slowly (often every few
  hours); no real host numbers by Demo Day.
- Your plan if it happens: phone hotspot as backup; a prepared, already-synced demo calendar plus "Sync now" on screen; the backup video; a clearly labelled seeded
  pilot if no host joins in time.

## 12. Checkpoint plan

### Checkpoint 1, Tue 3 Nov: core flow working and deployed

- What will work by then: steps 1 to 6 of section 5 on the public URL, on two phones, in English and Arabic: the
  owner adding a guesthouse with rooms, prices and photos (stored in Cloudflare R2), booking with the three modes,
  online payment with Whish (simulator) and Stripe (test mode) confirmed by webhook, the 10-minute payment window,
  full automatic refunds, the owner's decisions, closed dates, sign-in.
- Who owns each part: we split it among ourselves, each person building their features backend and screens; Omar
  owns the deployment and the live site. The work, in order, three things at a time, each built backend first (its
  API, tested in Postman or Swagger and by integration tests, then its screens):
  - Round 1 (Sat 31 Oct): the server base and sign-in engine; the design system and app frame; English and Arabic,
    the value lists and the permissions.
  - Round 2 (Sun 1 Nov): tenancy (each business sees only its own data); sign-in, accounts and creating a place;
    the demo data and the public place page.
  - Round 3 (Mon 2 Nov): the booking engine with the three modes; rooms, prices and photos; settings, the booking
    mode, and going live on DigitalOcean.
  - Round 4 (Tue 3 Nov, noon): online payments and full refunds; the owner's bookings, decisions and closed dates;
    the guest's booking pages.
  - Tue 3 Nov, afternoon: the three of us run the core flow on two phones on the live URL, once in each mode.
- What is still mocked or hardcoded: only Whish payments. We don't have a Whish merchant account yet, so Whish runs
  on our built-in Whish simulator. It follows Whish's real API (version 1.4.4), so switching to real Whish needs
  only the keys, no code change. Cards are not mocked: they use Stripe's real test mode. Payouts to owners are sent
  by hand from our Whish or Stripe account by design.

### Checkpoint 2, Tue 10 Nov: feature complete

- What you will add after Checkpoint 1: calendar sync with Airbnb and Booking.com, the calendar board, search, the
  full place page, contact host and the host profile, emails, notifications, team and roles, payouts, analytics with
  commission saved, realistic Lebanese demo data, the whole place and the place's details, empty and wrong-input states
  on every screen, back buttons, and browser tests of the core flow. Then, only if time allows, the bonuses in the
  order of section 9, starting with the host and guest MCP.
- Who owns each part: we split it among ourselves, three things at a time from Wed 4 Nov, with Tue 10 Nov for
  proving it on stage (isolation tests, the demo script).
- When your 3-minute demo script draft will be ready: Tuesday 10 November, rehearsed by the three of us
  on the live URL that evening, and final on Thursday 12 November.

### Submission, Fri 13 Nov: polished and recorded

- What you will fix and polish: only bugs found while rehearsing the core flow, and the demo screens on phones in
  English and Arabic; no new features after Tue 10 Nov. Three tasks from Wed 11 to Fri 13 Nov: bugs and the live
  site, polishing the demo screens, and the documents with the backup video.
- Who records the backup video, and on which day: Thursday 12 November, two of us (one demos on the two phones,
  one films); who exactly is still to be decided at our team meeting. Everything is submitted on Friday 13
  November.
