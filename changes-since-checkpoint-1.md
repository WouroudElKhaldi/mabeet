# Changes since Checkpoint 1 (Tuesday 3 November)

The main ones only.

## Added

- Calendar sync with Airbnb and Booking.com, so a room is never booked twice
- Payouts: hosts ask for their money, the admin marks it sent
- Admin area: hosts, people, money, health and categories
- Guest reviews, and a reviews page where hosts reply
- Billing page: plans paid by card or Whish
- Favourites and the guest's Activity page
- Contact host, Meet your host, map and photo tour on the place page
- Featured guesthouses and featured partners ("Things to do near your stay")
- Notification bell
- Email confirmation for every new account
- Guided setup for a new place, and adding more places from the dashboard
- AI (MCP) actions: confirm, decline and cancel bookings, close and reopen dates, sync calendars
- Playwright browser tests: core flow, no double booking, phone, 3 languages

## Changed

- Dashboard and admin lists became tables with search and filters, and adding opens in pop-ups
- Place, rooms and close-dates screens simplified
- Phones: tables and the calendar scroll inside their box
- Whish payments made safer and clearer
- Security fixes: the Whish simulator secret and the `body-parser` update
