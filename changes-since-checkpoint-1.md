# Changes since Checkpoint 1 (Tuesday 3 November)

From the 73 commits on `development`.

## Added

- Calendar sync with Airbnb and Booking.com (every 10 minutes, and again before each booking)
- Channels page (calendar links, Sync now)
- Payouts (owners ask, admin marks sent) and Payouts page
- Admin API and admin pages: overview, hosts with suspend, people, money, categories, site palette
- Admin host page and user details page
- Admin health page (calendar links that need a look)
- Admin plan offers, and the admin setting a place's plan
- Admin AI apps page (MCP usage)
- Notification bell, with API and full list
- Host profile, with API and page
- Profile pages (name, phone, password) for hosts and admins
- Billing page (plan, usage, pay by card or Whish)
- Favourites (saved places)
- Guest reviews of stays
- Reviews page for hosts (reply, hide, show)
- Guest Activity page
- Contact host and Meet your host
- Map, photo tour and Share on the place page
- Featured partners, with API, admin page and demo partners
- Featured guesthouses
- "Things to do near your stay": partners, then experiences and services
- Booking page: phone alerts to follow the booking
- Experiences and services: API, host page, sessions, seat bookings, guest page, browse tabs
- Experience photos, gallery, Show all photos, reviews and Meet your host
- MCP actions: confirm, decline, cancel, close and reopen dates, open or close rooms, sync calendars
- Guest connector: more results and host info
- Reopening part of closed dates
- Email confirmation for every new account
- Guided setup for a new place
- Setup checklist on a new place's home
- Place switcher in the dashboard
- Adding a place from the dashboard
- Archiving a place from Settings
- Maintenance page while the site is down (nginx)
- About us and Contact us in the header
- Playwright browser tests: phone, core flow, no double booking, 3 languages, buttons, money flows, Chrome journeys

## Changed

- Dashboard lists became tables, and adding opens in pop-ups
- Admin lists became tables with search, filters and pages
- Place and rooms pages simplified
- Close dates opens as a pop-up
- Tables and calendar scroll inside their box on phones
- Back button returns to the previous page
- Not-found pages show inside the site and dashboard frame
- Error page reloads once after a deploy
- Place gallery with fewer than 5 photos shows the large one alone
- Sign-in pages show photos of listed places
- Search bar and home hero layout on laptops
- Whish: an unknown payment reads as not paid
- Whish simulator secured with a server secret
- Contact host form kept when a place has no WhatsApp number
- Dates match on the server and in the browser; demo places have map pins
- Form fixes: silent refusals, real 404 for hidden places, 10-character password rule
- Pop-up text lines up at the start; pop-up buttons take their icon as an element
- Admin businesses list leaves out removed owners
- An existing account made admin gets its email confirmed
- `body-parser` updated to fix a security issue
- Texts in 3 languages and the team docs updated throughout
