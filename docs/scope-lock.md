# Scope: Mabeet

## 1. Team

- Members: Wouroud El Khaldi, Fatima Salami, Omar Antar.
- Who owns what: **still to be decided together.** We split the work into rounds of three tasks built at the same
  time, one per person, each task built by one person from the database to the screen (frontend, backend, AI and
  tests). We choose who takes each task at our team meeting after this call, and record it in our team plan
  (`docs/team/01-team-plan.md`). The pitch is prepared by the three of us.

## 2. Product in one sentence

We help Lebanese guesthouses and B&Bs take bookings directly on their own page, paid online in full or
arranged with the host, with one calendar that stays in sync with Booking.com and Airbnb, so they stop paying
the 15 to 18% platform commission on direct guests, stop losing requests in DMs, and are never double-booked.

## 3. The user

- Who exactly uses it: the owner (or front-desk staff) of a small Lebanese guesthouse, 3 to 15 rooms, who gets
  direct requests on Instagram and WhatsApp and may also sell on Booking.com and Airbnb. The guest uses the
  booking page.
- Real businesses you have talked to (name, how many conversations): we shortlisted 24 independent guesthouses that
  list on Booking.com or Airbnb (researched 21 October), and messaged the 12 of them that have an Instagram account,
  inviting each to a free two-week pilot. **None has answered yet, so we have had 0 conversations so far.**

  | Guesthouse                     | Area                       | Rooms   | Platforms           | Instagram         | Answer |
  | ------------------------------ | -------------------------- | ------- | ------------------- | ----------------- | ------ |
  | Beit El Qamar                  | Deir el Qamar, Chouf       | 8       | Booking.com, Airbnb | @beitelqamar      | None   |
  | Casadar Guesthouse             | Annaya, Jbeil district     | 6 to 7  | Booking.com, Airbnb | @casadarlb        | None   |
  | Villa Saf                      | Bhersaf, Metn              | 14      | Booking.com, Airbnb | @villa.saf        | None   |
  | Beyt El Jabal                  | Deir el Qamar, Chouf       | 4+      | Airbnb              | @beyteljabal_lb   | None   |
  | SaQi Guesthouse                | Saqi Rechmaya, Aley        | 5       | Airbnb              | @saqiguesthouse   | None   |
  | Beit Mirna Guesthouse & Chalet | Ehden                      | -       | Booking.com         | @beitmirna        | None   |
  | Beit Trad                      | Kfour, Keserwan            | 8       | to confirm          | @beittrad         | None   |
  | Mount Jackal                   | Qnat, Bcharre district     | 6       | to confirm          | @mount_jackal     | None   |
  | Beit El Nessim                 | El Mina, Tripoli           | 5       | to confirm          | @beitelnessim     | None   |
  | Colonel Bed and Brew           | Batroun                    | 5 units | to confirm          | @colonelbeer      | None   |
  | Dar Nour                       | Chabtine, Batroun district | 4       | to confirm          | @darnour_chabtine | None   |
  | Beit Teta Mona                 | Kfar Aaqab, Metn           | 3       | to confirm          | @beit.teta.mona   | None   |

  Next: we follow up by phone and WhatsApp on their public business numbers, starting with the top picks (Beit El
  Qamar, Casadar, Beyt El Jabal), and contact the other 12 through their Airbnb or Booking.com listings.

## 4. The problem today

- How they do it now: direct requests arrive in Instagram and WhatsApp DMs, are confirmed by hand and written in
  a notebook or a spreadsheet, and payments are chased by message. Hosts who also list on Booking.com or Airbnb pay
  commission there and block those calendars by hand after every direct booking.
- What it costs them: 15 to 18% of every platform booking, hours a week answering DMs and blocking calendars, and
  the occasional double booking (an angry guest, a refund, a bad review). No host has answered yet, so these are
  estimates from public prices, not a host's own figures: at Beyt El Jabal (from about $80 a night on Airbnb), every
  night sold through a platform costs the host $12 to $14.40 in commission, which is $240 to $288 a month for 20
  nights (section 10). We replace this with a real host's numbers as soon as one answers.

## 5. The one core flow

Live on stage, two phones: the guest's and the owner's (both already signed in). The guesthouse uses mode 2
(online payment, owner approval), which is the brief's "booking request confirmed by the owner".

1. The guest opens the guesthouse's booking link (from its Instagram bio) and picks dates. Nights already taken on
   Airbnb and Booking.com show as taken, because those calendars are synced.
2. The guest sees the price per night and the total, enters name and phone, and pays the full amount online with
   Whish or a card. The room is held for them at once.
3. A second guest tries the same night and is refused on the spot: the database itself will not store two stays on
   one room night.
4. Whish or Stripe confirms the payment (webhook). The owner gets the request on their phone. The app re-reads the
   Airbnb calendar, and the owner confirms.
5. The guest's confirmation page shows "confirmed", and the night is now closed on Airbnb and Booking.com too,
   through our calendar link.
6. The owner tells the AI assistant "Close the Arched room from 12 to 15 November", checks the action card and
   confirms, then asks "How much commission did direct bookings save me this month?" and gets the answer with the
   figures it was computed from.

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
- The platform takes no commission; it earns only from host plans. Offline payments are between the owner and the
  guest (written in the payment policy).

## 6. Where the AI fits

Two AIs, both calling the same services and permission checks as the website, so they can never do more than the
person behind them:

- **Guests:** a trip concierge on the website and a public guest MCP (for Claude, ChatGPT or any MCP client). They
  search places and check dates and prices. Read-only: they link to the booking page and never book.
- **Owners and staff:** an assistant in the dashboard and a host MCP (Claude, Cursor, Codex or any MCP client,
  connected with a personal key or by signing in). They answer questions (free rooms, bookings, revenue, commission
  saved) and carry out orders like "cancel booking SN-7KX3P9" or "for Dar Al Sindiyan, close the Arched room from
  12 to 15 November".

- What the model does in this flow: understands the owner's question or order and chooses which of our tools to
  call, with which details. It decides nothing about the business itself: the tools do the work.
- What goes in, what comes out: the question plus the tool results from our database go in. A short answer comes
  out, every figure on screen comes from tool data, and an order comes out as a proposed action.
- How you check the output before the user sees it: every tool's input is validated with a schema, and runs the
  same permission and tenant checks as the dashboard. In the dashboard, a change is never made straight away: the
  owner sees a card with the exact action and its validated details (not the model's wording) and presses Confirm
  or Cancel. In Claude, Cursor or Codex, write tools are marked as changing data, so the app asks the person first,
  and read-only keys never see them. Text written by guests is marked as data, never instructions. Every tool call
  is logged.
- What happens when the model is wrong or slow: a wrong order fails the tool's own checks (unknown booking, dates
  already taken, a room name that fits two rooms) and the owner sees why. A 45-second timeout, then a clear
  message; the rest of the app keeps working. When the model fails, the figures are shown straight from the tools.
  A monthly spend cap and rate limits on every AI route.

## 7. Tech stack and hosting

- Stack: Next.js 15 (route handlers in TypeScript), Prisma and PostgreSQL (an EXCLUDE constraint refuses
  overlapping stays), Better Auth (owner and staff roles), Zod validation on every route, DeepSeek for the AI, iCal
  import and export, Whish (simulator until merchant keys) and Stripe test mode, Tailwind, English and Arabic from
  the first day.
- Where it will be deployed: DigitalOcean, with Docker, deployed by GitHub Actions only after types, lint and all
  tests pass.
- Live URL: we have not bought a domain yet, because we are not 100% sure of the name (Mabeet). Until we are, the
  site runs on the free public address DigitalOcean gives the app (`…ondigitalocean.app`), live by Monday 2 November,
  before Checkpoint 1. Once the name is final we buy the domain and point it at the same app; nothing else changes.

## 8. Must work on stage (max 5)

1. The guest pays the full amount online, the owner confirms, and the guest gets the confirmation page.
2. The second guest for the same room night is refused (zero double bookings).
3. Airbnb and Booking.com nights block the booking page, and our bookings close the night on their side.
4. The dashboard shows direct bookings and commission saved.
5. The owner's AI assistant carries out an order after the owner confirms it, and answers a business question with
   checked figures, falling back cleanly when the model fails.

## 9. Cut list (not building before Demo Day)

Not building at all: bookings from Airbnb or Booking.com inside our system (we only import their taken nights to
block the calendar), recording payments made outside the platform (offline mode is between the owner and the
guest), Kazderni (no API or calendar link), moving closed dates by drag and drop, automatic payouts, automatic pricing,
in-app chat, a native app.

Bonus, built after the must-haves work: host plans paid instantly with Stripe or Whish; experiences and services; the
guest concierge; the AI assistant and MCP for Claude, Cursor and Codex; AI reports; reviews and favourites; push
notifications; installing the app; the admin area; and last, booking through the guest's AI and MCP (the AI
makes the booking after the guest says yes, and the guest pays on the booking's own page).

The owner's AI assistant counts as a bonus for the challenge, but we build it before Checkpoint 2 and show it on stage
(step 6 of section 5, item 5 of section 8). The core flow (steps 1 to 5) never depends on it, so if the model is
slow or down on stage, the booking demo still works and the assistant shows the figures without the model. MCP for
Claude, Cursor and Codex stays a true bonus.

## 10. The outcome number

Estimate from public prices (to confirm with the host): Beyt El Jabal in Deir el Qamar, 4 suites on Airbnb, from
about $80 a night with breakfast. If 10 bookings a month of 2 nights move from Airbnb or Booking.com to direct, that
is 20 nights × $80 = $1,600 a month. At 15 to 18% commission, **the host keeps $240 to $288 a month, about $2,900 to
$3,450 a year**, with zero double bookings. The dashboard computes this from the owner's own commission rate.

## 11. Biggest risk

- What could stop the demo from working: venue Wi-Fi; the AI being slow on stage; Airbnb refreshing our calendar
  slowly (often every few hours); no real host numbers by Demo Day.
- Your plan if it happens: phone hotspot as backup; the AI fallback that shows the figures without the model; a
  prepared, already-synced demo calendar plus "Sync now" on screen; the backup video; a clearly labelled seeded
  pilot if no host joins in time.

## 12. Checkpoint plan

### Checkpoint 1, Tue 3 Nov: core flow working and deployed

- What will work by then: steps 1 to 5 of section 5 on the public URL, on two phones, in English and Arabic:
  booking with the three modes, online payment with Whish (simulator) and Stripe (test mode) confirmed by webhook,
  the 10-minute payment window, full automatic refunds, the owner's decisions, closed dates, sign-in.
- Who owns each part: still to be decided at our team meeting. The work is rounds 1 to 4 of our team plan, twelve
  tasks, three at a time, each merged by the date shown:
  - Round 1 (Sat 31 Oct): the server base and sign-in engine; the design system and app frame; English and Arabic,
    the value lists and the permissions.
  - Round 2 (Sun 1 Nov): tenancy (each business sees only its own data); sign-in, accounts and creating a place;
    the demo data and the public place page.
  - Round 3 (Mon 2 Nov): the booking engine with the three modes; rooms, prices and closed dates; settings, the
    booking mode, and going live on DigitalOcean.
  - Round 4 (Tue 3 Nov, noon): online payments and full refunds; the owner's bookings and decisions; the guest's
    booking pages.
  - Tue 3 Nov, afternoon: the three of us run the core flow on two phones on the live URL, once in each mode.
- What is still mocked or hardcoded: only Whish payments. We don't have a Whish merchant account yet, so Whish runs
  on our built-in Whish simulator. It follows Whish's real API (version 1.4.4), so switching to real Whish needs
  only the keys, no code change. Cards are not mocked: they use Stripe's real test mode. Payouts to owners are sent
  by hand from our Whish or Stripe account by design.

### Checkpoint 2, Tue 10 Nov: feature complete

- What you will add after Checkpoint 1: calendar sync with Airbnb and Booking.com, the calendar board, search, the
  full place page, contact host and the host profile, emails, notifications, team and roles, payouts, analytics with
  commission saved, realistic Lebanese demo data, the owner's AI assistant with the confirm card and its fallback
  (needed for step 6 of section 5 and item 5 of section 8), the whole place and photos, empty and wrong-input states
  on every screen, back buttons, and browser tests of the core flow. Then, only if time allows, the bonuses in the
  order of section 9: plans, experiences, the concierge, MCP, AI reports, reviews and favourites, push, installing
  the app, the admin area, and booking through the guest's AI.
- Who owns each part: still to be decided at our team meeting. The work is rounds 5 to 10 of our team plan, one
  round a day from Wed 4 Nov, three tasks at a time, with the AI assistant over Sun 8 and Mon 9 Nov and Tue 10 Nov
  for proving it on stage (isolation tests, the AI with a scripted model, the demo script).
- When your 3-minute demo script draft will be ready: Tuesday 10 November (task 10C), rehearsed by the three of us
  on the live URL that evening, and final on Thursday 12 November.

### Submission, Fri 13 Nov: polished and recorded

- What you will fix and polish: only bugs found while rehearsing the core flow, and the demo screens on phones in
  English and Arabic; no new features after Tue 10 Nov. Three tasks from Wed 11 to Fri 13 Nov: bugs and the live
  site, polishing the demo screens, and the documents with the backup video.
- Who records the backup video, and on which day: Thursday 12 November, two of us (one demos on the two phones,
  one films); who exactly is still to be decided at our team meeting. Everything is submitted on Friday 13
  November.
