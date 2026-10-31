# Functional requirements (new project)

What the product does, for each kind of user. This replaces the reference project's list for the new project.
How well it must work is in `docs/non-functional-requirements.md`.

## The problem

Lebanese guesthouse hosts pay 15 to 18 percent commission to Airbnb and Booking.com. Direct requests get lost in
Instagram and WhatsApp. Hosts who manage several calendars sometimes sell the same night twice.

## What success looks like

1. Guests book straight from the host's own page.
2. The host sees how much commission that saved them.
3. Nobody is ever double-booked.

## How booking and payment work (the three modes)

Each business chooses **one** of three modes. Every online payment goes to the platform's Whish or Stripe account,
always for the **full amount**. The platform pays the owner later, by hand (see F12a).

| Mode                         | How the guest pays                                                      | Who confirms                                                                                       | If it is cancelled                                    |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **1. Automatic**             | Online, full amount, with Whish or a card                               | Nobody: the booking is confirmed automatically when Whish or Stripe confirms the payment (webhook) | Full automatic refund                                 |
| **2. Online, with approval** | Online, full amount, with Whish or a card                               | The owner confirms or declines                                                                     | Declined, expired or cancelled: full automatic refund |
| **3. Offline**               | Not through the platform: the guest and the owner arrange it themselves | The owner confirms or declines by hand                                                             | Between the owner and the guest                       |

Rules for the online modes (1 and 2):

- **10 minutes to pay.** When the guest presses "Pay" and goes to Whish or Stripe, the room is held for 10
  minutes. If no payment confirmation arrives in that time, the booking is cancelled, the room is free again, and
  the nights reopen in our calendar link for Airbnb and Booking.com.
- **The owner must answer in time (mode 2).** After the guest pays, the owner has the business's answer time
  (`holdHours`, 24 hours by default) to confirm or decline. If they do not answer, the booking expires and the guest
  gets a full automatic refund. The guest's money is never stuck.
- **Refunds are always full and automatic.** Whoever cancels, the guest gets the full amount back through Whish or
  Stripe. The owner accepts this when choosing an online mode (it is written in the payment policy).

For mode 3, payments made outside the platform are between the owner and the guest. The platform does not record
or handle them. This is written in the payment policy.

---

## Part A. Must have

The main flow in Checkpoint 1 (Tuesday 3 November) is: F3, F4, F4a, F4b, F7, F9, F9a, F11 and F17, in English and
Arabic (F18). Everything else in Part A is finished by Checkpoint 2 (Tuesday 10 November).

### Guests

- **F1. Find a place.** Search stays by dates, guests, area, category, price, amenities, tags and accessibility.
- **F2. See the details.** A place page shows photos, rooms, amenities, reviews, a map and house rules. Under the
  photos: how many guests, bedrooms, beds and baths, the rating and review count, and who hosts it. "Meet your host"
  shows the host's years hosting, response rate and response time. A photo tour groups photos by room. "Show all"
  (photos, reviews, amenities) opens a popup, a full-screen sheet on a phone. Listings can be shared.
- **F2a. Contact the host.** Depending on the host's choice: a WhatsApp button, a Contact host page whose form
  emails the host (who replies straight to the guest), or both. The page first answers what guests usually ask:
  getting there, check-in times, how payment works, cancellation and house rules.
- **F3. Book.** The guest picks dates. The room is held for them at once, so nobody else can take it. What happens
  next depends on the business's mode (see the table above). Booking needs an account: a signed-out guest signs in
  or signs up first, then comes straight back to the dates they picked. A host can also rent the whole place as one
  unit; then it is booked whole, never room by room. Switching between the two keeps every existing booking: from
  then on only the new way can be booked, and only on nights those bookings don't use. A room stay that is running
  when the host switches to the whole place keeps the whole place closed until it checks out.
- **F4. Follow the booking.** Signed in, the guest sees each booking in their account: its status, what to pay
  (online modes), and a WhatsApp button to the host. A booking's link opens only for the guest who made it; signed
  out, they sign in first and come back to it. The guest is also emailed when anything changes.
- **F4a. Pay online (modes 1 and 2).** The guest pays the full amount with Whish or a card. In mode 1 the booking
  is confirmed the moment the payment is confirmed. If no payment arrives within 10 minutes, the booking ends and the
  room is free again.
- **F4b. Get refunds (modes 1 and 2).** Any cancellation of a booking paid online is refunded in full,
  automatically, through Whish or Stripe.

### Hosts and their staff

- **F7. List rooms and prices.** Rooms, price per night, special prices for given nights, photos. The place's own
  details (description, rules, photos by area, whole place or by room) are on a "Your place" page.
- **F7a. Host profile.** One profile per host, shared by all their places: name, bio, languages, hosting since,
  and how guests can reach them (WhatsApp, Contact host, or both). The WhatsApp number is always the place's own, the
  same one the booking page shows. Guests see the personal details only if the host turns that on.
- **F9. Decide on bookings.** In modes 2 and 3, confirm or decline requests. In every mode, cancel a booking.
  Bookings nobody answers expire on their own and free the room (with a full refund in mode 2).
- **F9a. Choose the mode.** The owner picks one of the three modes for the business.
- **F10. One calendar.** Direct bookings, closed dates and the nights already taken on Airbnb and Booking.com, in
  one view, by month, by week or by room, with a panel for the chosen day. Each room publishes its own calendar link
  for Airbnb and Booking.com to read, and reads theirs back. Nights taken on Airbnb or Booking.com only block the
  calendar: they are not bookings in our system (no guest, no money, no numbers). When Airbnb or Booking.com sends
  a booking over nights already sold here (they refresh only every few hours), both stays are kept and nothing is
  cancelled: the clash has a red outline, and the hosts get a notification, an email and a push once, when it
  appears. It clears by itself as soon as either booking is cancelled, on our side at once, on theirs at the next
  sync.
- **F11. Close dates by hand.** For maintenance, or a booking taken by phone.
- **F12. See the numbers.** Occupancy, direct revenue, response time and rating, for any period, per place or for
  all of a host's places together. And the **commission saved**: the commission Airbnb or Booking.com would have
  taken on the direct revenue (direct revenue × the host's commission rate). Owners with several places get one
  "All my places" overview.
- **F12a. Get paid out.** See what guests paid online, what is available (stays that have started) and what is
  still coming, and ask for a payout to a bank account (IBAN) or a Whish number. A platform admin sends it by hand.
- **F13. Build a team.** Owners invite staff and make their own roles by ticking permissions. Nobody can give a
  permission they do not have.
- **F14a. Notifications.** A bell shows the latest five things that happened (bookings, payments, cancellations,
  reviews, team changes). "View all" opens the full list, page by page.

### Everyone

- **F17. Sign in and close the account.** Email and password, email verification, password reset. Anyone can
  delete their account by typing their email: they are signed out everywhere and can't sign in again, their email
  is free for a new account, and their saved places, chats and team access go away. Their bookings and reviews
  stay with the host, the reviews without their name.
- **F18. Three languages.** English, Arabic and Lebanese Arabic, right-to-left included, from the first day. Anyone
  can switch from the menu.
- **F21. Find the way back.** Every page has a Back button to the page it belongs to (a room's page goes to its
  place, a place to search). It works the same after a refresh or from a shared link.

---

## Part B. Bonus

These are built after Part A works, by Checkpoint 2 (Tuesday 10 November) if possible, and polished by the
submission (Friday 13 November).

### Guests

- **F2 (experiences).** An experience page shows its sessions and how many spots are left.
- **F5. Keep an account.** Trips, favourites, an activity history, and one review per stay, written only after
  check-out by the guest who actually stayed.
- **F6. Ask your AI app about places (big bonus, the first AI bonus).** Through the guest MCP, from Claude, ChatGPT
  or any MCP app, with no sign-in, a guest describes a trip and gets places that are really free on those dates. The
  search takes a town or a region (`src/config/regions.ts`), bedrooms, bathrooms, beds, amenities (a jacuzzi
  included), tags and accessibility, and shows each matching room's layout. It is always read-only: it searches,
  checks dates and prices, and links to the booking page. It never books. A page on the website ("Use Mabeet from
  your AI app") explains what MCP is, why a guest would use it and how to connect, and shows the guest MCP address
  to copy.
- **F22. Things to do near your stay (bonus).** On a place's page, once the guest picks dates, and on the booking's
  page: experiences and services in the same region with a session during the guest's nights, nearest first, each
  linking to its own page.
- **F6 (the travel assistant on the website, last bonus).** The same search and the same read-only tools, answered
  by our own model (DeepSeek) in a chat on the website, in English, Arabic or Arabizi.

### Hosts and their staff

- **F8. List experiences and services.** Hikes, tastings, transfers and the like, with repeating sessions and a
  number of seats. The database includes them from the start.
- **F14. Connect an AI app (big bonus, the first AI bonus).** Personal keys or an OAuth sign-in to connect Claude,
  ChatGPT, Cursor, Codex or any MCP app (the host MCP). One key reaches every place the person works in; they name
  the place they mean. In each place, the AI sees exactly what that person's role there allows. The person's own AI
  app brings the model, so this needs none of ours.
  - **First version: read and report only.** Free rooms, bookings, revenue, the commission saved, and the numbers
    for a report over a period (from the same figures as the analytics page; the person's AI app writes the report).
    No tool changes data.
  - **Then, a few actions (bonus after the first version).** Only what the person's role allows: cancel a booking
    (with the full automatic refund), close or reopen dates, and confirm or decline a request waiting for the owner.
    The same services and checks as the dashboard buttons. They are marked as changing data, so the AI app asks the
    person before each one, and a read-only key never sees them. Marking a guest as arrived needs a new booking
    state first, from the database keeper.
- **F12 (AI report in the dashboard, last bonus).** Our own model (DeepSeek) writes a report from the same numbers.
- **F14 (the assistant in the dashboard, last bonus).** A chat in the dashboard answered by our own model (DeepSeek).
  It can carry out the same actions, but never on its own: the person confirms a card that shows the exact action.
  Chats are saved, or kept unsaved and never stored.
- **F14b. Never stuck waiting on the AI (last bonus, with the website travel assistant and the dashboard
  assistant).** A short question is answered straight away. A
  long one, a long conversation, an AI report, or any question while others are being answered goes in line for
  the worker: the screen says what it is doing ("Searching what's free…"), then shows the answer word by word. The website and other
  people's requests are never held up by it. Built with queues (pg-boss) and a worker process; see
  `02-architecture-and-features.md`, "B. Queues and the worker".
- **F15. Choose a plan (bonus).** Free, Pro or Business, each with its limits (rooms, experiences, team members,
  AI). Paid instantly, by card through Stripe (a subscription, turned on as soon as Stripe confirms it) or with
  Whish (a month at a time). There is no paying by hand and nothing waits for an admin's approval. Plans and
  sponsored listings (F23) are the platform's only income: no commission or fee on bookings, on any plan.

### Platform admins

- **F16. Run the platform.** Platform numbers, every host with all their businesses, suspend or reactivate a
  business, open any business's dashboard to help (logged under the admin's own name), manage categories, set the
  site's colour palette, watch calendar sync health and AI spending. Every action is logged.
- **F23. Featured partners and sponsored listings (bonus).** Admins add partner places that are not on the platform
  (restaurants, supermarkets, parks, museums and the like) with their region and map pin, and can sponsor a partner
  or an experience or service of the platform for a set of dates. Guests see them in "Things to do near your stay"
  (F22): sponsored ones first, always marked "Sponsored". Every change is logged.
- **F16a. Run the money.** What the platform earned from plans (all time, this month, by month, card or Whish),
  what it holds for each host, payout requests to send and mark as sent, and refunds that failed and must be sent by
  hand. Plans are paid instantly, so there are no plan payments to approve.

### Everyone

- **F19. Phone notifications.** Anyone can turn on push notifications on their phone and get every update they
  would be emailed. Guests get their bookings' updates on every device of their account.
- **F20. Install the app.** The site can be added to a phone's home screen and opens like an app, with an offline
  page when there is no signal.

---

## Not in this version

- Bookings from Airbnb or Booking.com inside our system (we only import their taken nights to block the calendar).
- Recording payments made outside the platform (mode 3 is between the owner and the guest).
- Kazderni (no API and no calendar link).
- Moving closed dates by drag and drop.
- Real Whish payments: the platform has no Whish merchant account yet, so a built-in simulator that follows Whish's
  real API is used. Switching to real Whish needs only the keys. Cards use Stripe's real test mode.
- Automatic payouts to owners (an admin sends each one and marks it sent).
- In-app chat, automatic pricing, native mobile apps (the website installs as an app instead).
- Booking through an AI (the website assistant or the guest MCP). The guest's AI only searches and links to the
  booking page; the guest always books and pays on our site.
