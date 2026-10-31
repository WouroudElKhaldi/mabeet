# The database diagrams, explained simply

A plain-English guide to [erd-platform.md](erd-platform.md) and [erd-ai-mcp.md](erd-ai-mcp.md).

---

## First, how to read the lines

A **table** is a list of one kind of thing, like a list of users or a list of rooms.

A **relation** is a link between two tables. Almost every link in this diagram is the same kind:

> **"One A has many B."** For example, one business has many rooms, and each room belongs to one business.

Some links are **optional**. For example, a booking _may_ have a user, because guests can book without an account.

A few links are **one-to-one**. For example, one booking has one review at most.

---

# Part 1: The Platform ERD

## 👤 People and logging in

### 1. User

A person with an account. It could be a guest, a business owner, a staff member, or a platform admin. `platformRole` says if they are a normal user or an admin of the whole site.

- One user → **one host profile** (at most)
- One user → **many sessions**
- One user → **many accounts**
- One user → **many memberships** (they can work at many businesses)
- One user → **many bookings** and **many session bookings** (optional, since guests can book without logging in)
- One user → **many favorites**, **many reviews**, **many activity logs**
- One user → **many plan payments** (the owner who paid)
- One user → **many push subscriptions**
- One user → **many AI chats**, **API keys** and OAuth things (explained in Part 2)

### 2. HostProfile

The "about the host" card shown to guests: name, bio, city, languages, and how guests may contact them. The
numbers guests call are the **business's** own (its WhatsApp and phone); the host's personal phone is on their user.

- It belongs to **one user**. A user has at most one.

### 3. Session

"You are logged in right now on this device." When it ends, you are logged out.

- It belongs to **one user**.
- It also has `mcpBusinessId`: when an AI app is logged in, this says which business it is working on.

### 4. Account

**How** a user logs in: with a password, or with Google, and so on.

- It belongs to **one user**. One user can have many ways to log in.

### 5. Verification

Short-lived codes, for example "verify your email" or "reset your password." It has no links.

---

## 🏨 Businesses and teams

### 6. Business

The main thing on the site: a guesthouse, a hotel, a chalet, a tour company. It holds the name, address, map location, currency, check-in time and house rules. It also holds the business's **choices**:

- `bookingMode`: one of three modes. **Automatic**: the guest pays online and the booking is confirmed by the payment. **Online with approval**: the guest pays online, then the owner confirms. **Offline**: no payment through the site; the owner confirms by hand. Guests always pay the full price (no deposits), and every online refund is full
- `onlineTermsAcceptedAt`: when the owner accepted "online payments are always refunded in full" (needed for the two online modes)
- `plan`: which subscription the business pays for
- `status`: for example active or suspended

The business is the "parent" of almost everything:

- One business → **many** roles, memberships, rooms, photos, bookings, occupancies, calendar feeds, payments, refunds, payouts, plan payments, reviews, favorites, offerings, sessions, session bookings, stored images, activity logs, API keys and MCP logs.

### 7. Role

A job title inside a business, like "Owner" or "Receptionist," with a list of what it is allowed to do (`permissions`).

- It belongs to **one business**.
- One role → **many memberships**.

### 8. Membership

"This person works at this business with this role." It **connects** a user, a business and a role.

- It belongs to **one user**, **one business** and **one role**.
- One membership → **many API keys**.

---

## 🛏️ Rooms, photos, prices

### 9. Room

A room or unit that can be booked: how many guests, bedrooms, beds, bathrooms, the normal price per night, and amenities like Wi-Fi or a jacuzzi.

- It belongs to **one business**.
- One room → **many** photos (optional), price changes, calendar feeds, bookings, occupancies and reviews.

### 10. Photo

A picture. It always belongs to **one business**. It can also belong to **one room** _or_ **one offering**.

### 11. RateOverride

"On this date, this room costs a different price." For example, a higher price on New Year's Eve.

- It belongs to **one room**.

### 12. StoredImage

The real image file, kept inside the database.

- It belongs to **one business**.

---

## 🏷️ Categories

### 13. Category

A type of place or activity, like "Chalet," "Guesthouse" or "Hiking," with an English name, an Arabic name and an icon.

### 14. BusinessCategory

A **connector table**. One business can be in many categories, and one category can hold many businesses. Each row just says "business X is in category Y."

- It belongs to **one business** and **one category**.

---

## 📅 Bookings and calendars

### 15. Booking

A guest booking a **room** for some nights. It holds the guest's name and phone, check-in and check-out dates, the price (paid in full, never a deposit) and the status (waiting, confirmed, cancelled…).

- It belongs to **one business** and **one room**.
- It _may_ belong to **one user**.
- One booking → **one occupancy** (at most)
- One booking → **many payments**
- One booking → **one review** (at most)

### 16. Occupancy

**"These nights are taken."** This is the room's calendar. A night can be taken for three reasons:

1. a booking on our site
2. the owner blocked it by hand
3. it came from Airbnb or Booking.com through a calendar feed

A database rule makes sure **two stays can never take the same room on the same night**. No double booking.

- It belongs to **one business** and **one room**.
- It _may_ belong to **one booking** (one-to-one).
- It _may_ belong to **one calendar feed**.

### 17. CalendarFeed

A link to an **outside calendar** (Airbnb, Booking.com) for one room. The site reads it, so nights booked there also show as taken here.

- It belongs to **one business** and **one room**.
- One feed → **many occupancies**.

---

## 🧗 Experiences (tours and activities)

### 18. Offering

An activity, not a room. For example a hike, a cooking class or a boat tour. It holds the price, how long it takes, the meeting point and the level (easy or hard).

- It belongs to **one business**.
- It _may_ belong to **one category**.
- One offering → **many** sessions, session bookings, photos and reviews.

### 19. OfferingSession

**One date and time** for an offering, with a number of seats. For example "Saturday 9am, 12 seats."

- It belongs to **one business** and **one offering**.
- One session → **many session bookings**.

### 20. SessionBooking

A guest booking **seats** in one session. It is like Booking, but for activities. A database rule makes sure a session **never sells more seats than it has**.

- It belongs to **one business**, **one offering** and **one session**.
- It _may_ belong to **one user**.
- One session booking → **many payments**.
- One session booking → **one review** (at most).

---

## 💰 Money

Every amount is a whole number of **cents** (9999 means 99.99) in the record's currency, stored as a big
number (BigInt) so that prices in Lebanese pounds fit too.

### 21. Payment

Money a **guest** paid, online or in cash.

- It belongs to **one business**.
- It belongs to **either** one booking **or** one session booking.
- One payment → **many refunds**.

### 22. Refund

Money given **back** to a guest.

- It belongs to **one business** and **one payment**.

### 23. Payout

The business asks the platform: "Send me my money," by bank or by Whish.

- It belongs to **one business**.

### 24. PlanPayment

The business paying for its plan, always **instantly**: by card (Stripe) or with Whish. Nobody pays by hand and no
admin approves anything. It also records how many months the payment bought.

- It belongs to **one business**.
- It _may_ belong to **one user** (the owner who paid; empty for automatic Stripe renewals).

### 25. WhishSandboxPayment

**Fake** Whish payments, for testing only. It has no links.

### 26. WebhookEvent

Messages that payment companies send to us ("this payment succeeded"). We save each one so we never handle the same message twice. It has no links.

---

## ⭐ Guests' extras

### 27. Favorite

"This user saved this business with a heart."

- It belongs to **one user** and **one business**.

### 28. Review

One overall star rating and a comment. The owner can reply, and an admin can hide it.

- It always belongs to **one business**.
- It _may_ belong to a room, a booking, an offering, a session booking and an author (user).
- One booking or one session booking has **one review at most**.

---

## 🔧 System tables

### 29. ActivityLog

A diary of "who did what," for example "Sara confirmed booking #123."

- It _may_ belong to **one user** and _may_ belong to **one business**.

### 30. PushSubscription

Lets us send **notifications** to a phone or browser.

- It always belongs to **one user** (booking needs an account). One browser is one row: its push address is unique.

### 31. SiteSetting

Settings for the whole site, like the color theme. It has no links.

---

# Part 2: The AI and MCP ERD

**MCP** is the way outside AI apps (like Claude or ChatGPT) connect to a business's data. **OAuth** is the safe "Log in and allow this app" process.

## 🤖 The site's own AI assistant

These tables wait for the last bonuses (our own model). The MCP does not use them.

### 1. AiChat

One conversation with the AI assistant, with a title.

- It belongs to **one user**.
- It _may_ belong to **one business** (when an owner chats about their business).
- One chat → **many messages**.

### 2. AiChatMessage

One message in a chat, from the user or from the AI.

- It belongs to **one chat**.

### 3. AiUsage

How much each AI answer **cost**: tokens and money. It has no real links. It just notes the business id as plain text.

### 4. JobProgress

Live status of slow background work, like "searching rooms…", so the screen can show progress while the answer is being made. It has no links.

---

## 🔑 Outside AI apps: simple keys

### 5. ApiKey

A **secret key** a staff member makes so an AI app can reach the business's data. It can be read-only or allowed to change things (`canWrite`). It can expire or be turned off. We only save a **hash** of the key, never the key itself.

- It belongs to **one business**, **one membership** and **one user** (who made it).
- Because it is tied to the membership, if the person leaves the business, the key stops being useful.

### 6. McpAuditLog

A diary of **every action an AI app did**: which tool, whether it worked, and how fast. It is for safety and checking.

- It belongs to **one business**.

---

## 🔐 Outside AI apps: "Log in and allow" (OAuth)

Think of it like a hotel: the **app** is a visitor, the **consent** is the owner saying "let them in," the **access token** is a day pass, and the **refresh token** lets them get a new day pass without asking again.

### 7. OauthClient

An **app** that is registered to connect, for example Claude. It holds its name, logo, and where to send people back after login.

- It _may_ belong to **one user**.
- One app → **many** client-resources, refresh tokens, access tokens and consents.

### 8. OauthResource

**The thing being protected**: our MCP server. It also says how long passes last.

- One resource → **many client-resources**.

### 9. OauthClientResource

A **connector table**: "this app may use this resource."

- It belongs to **one app** and **one resource**.

### 10. OauthConsent

"This user said **yes**, this app may access these things (`scopes`)."

- It belongs to **one app**. It _may_ belong to **one user**.

### 11. OauthAccessToken

The **short pass** the app shows on every request.

- It belongs to **one app**.
- It _may_ belong to **one user**, **one session** and **one refresh token** (the one that made it).

### 12. OauthRefreshToken

The **long pass** used to get new short passes.

- It belongs to **one app** and **one user**. It _may_ belong to **one session**.
- One refresh token → **many access tokens**.

### 13. Jwks

The site's **signing keys**. They are like a stamp that proves a pass is real. It has no links.

### 14. OauthClientAssertion

Remembers one-time proofs an app already used, so nobody can use them again. It has no links.

---

**Not in the diagram:** the job queues for AI, emails and schedules. A tool called pg-boss keeps them in its own part of the database.
