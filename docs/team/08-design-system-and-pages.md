# Design system and pages

This file is the one place for how the app **looks** and how every **page** is built. All three of us, and our
Claude, follow it exactly. The new project looks the same as the reference project: same themes, colours, fonts,
spacing, components and page layouts.

How to use it:

- Before you build a screen, read its entry in Part 8 (pages) and the parts it points to.
- Then open the same file in the reference project and copy its structure and class names.
- If you need something that is not here, ask in Discord first. Do not invent a new colour, size or component.

---

## Part 1. The rules

1. **Tokens only.** Use the colour names in Part 2 (`bg-surface`, `text-muted`, `ring-line`…). Never write a hex
   code, `rgb()`, or a Tailwind colour like `bg-gray-100` or `text-green-700` in a component.
2. **Themes are not chosen by us.** There are 5 palettes (Cedar, Byblos, Batroun, Baalbek, Jounieh), each with a
   light and a dark mode. The platform admin picks the palette for the whole site. Visitors only switch light and
   dark. A component never knows which palette is on: it uses the tokens, and the palette fills them.
3. **Shared components first.** Use the components in Part 6 (`Button`, `Field`, `Panel`, `PageHeader`…). Never
   style your own button or input.
4. **Right-to-left works by itself.** Use `start`/`end`, never `left`/`right`: `ms-2`, `me-2`, `ps-4`, `pe-4`,
   `start-0`, `end-3`, `text-start`, `border-s`. Never `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`.
5. **Phones first.** Every page works on a 390-pixel-wide screen with no sideways scroll. Then it grows with `sm:`
   (640px), `md:` (768px), `lg:` (1024px).
6. **Every text comes from the language files** (`messages/en.json`, `ar.json`, `ar-LB.json`). No text written
   in a component.
7. **Every page has its four states:** loading, empty, error and normal (Part 7).

---

## Part 2. Colours

### 2.1 The tokens and when to use them

Tailwind 4 reads the tokens from `src/app/globals.css` (`@theme inline`). So each token is also a class:
`bg-<name>`, `text-<name>`, `ring-<name>`, `border-<name>`, `fill-<name>`.

| Class name      | CSS variable      | Use it for                                                          |
| --------------- | ----------------- | ------------------------------------------------------------------- |
| `paper`         | `--paper`         | The page background (the canvas behind everything)                  |
| `surface`       | `--surface`       | Cards, panels, inputs, the sidebar                                  |
| `surface-2`     | `--surface-2`     | Hover background, subtle blocks, table header rows, skeletons       |
| `ink`           | `--ink`           | Main text, dark buttons (the user's chat bubble), focus rings       |
| `muted`         | `--ink-muted`     | Secondary text: intros, hints, labels under numbers                 |
| `faint`         | `--ink-faint`     | Placeholders, small group titles in the side menu                   |
| `line`          | `--line`          | Hairline borders and dividers (`ring-1 ring-line`, `divide-line`)   |
| `line-strong`   | `--line-strong`   | Input borders, stronger dividers                                    |
| `accent`        | `--accent`        | Primary buttons, links, the active menu item, checked boxes         |
| `accent-strong` | `--accent-strong` | Hover state of `accent`                                             |
| `accent-ink`    | `--accent-ink`    | Text on an `accent` background                                      |
| `accent-soft`   | `--accent-soft`   | A light tint of the accent: selected chips, highlight cards         |
| `accent-line`   | `--accent-line`   | Border of `accent-soft` blocks, the line beside AI replies          |
| `glow`          | `--glow`          | The second accent: the small bar above page titles, markers, charts |
| `success`       | `--success`       | "Confirmed", "Paid", good numbers                                   |
| `warning`       | `--warning`       | "Waiting", "Expiring soon"                                          |
| `danger`        | `--danger`        | Errors, "Declined", "Cancelled", the danger button                  |
| `danger-ink`    | `--danger-ink`    | Text on a `danger` background                                       |
| `scrim`         | `--scrim`         | The dark layer behind a dialog                                      |

Opacity is allowed on tokens: `bg-paper/85`, `bg-ink/40`, `hover:ring-ink/40`.

### 2.2 Brand colours (logos only)

These never change with the palette. Use them **only** for the logo or mark of that company:

| Class             | Value     | For                                           |
| ----------------- | --------- | --------------------------------------------- |
| `brand-whatsapp`  | `#25d366` | WhatsApp buttons and icon                     |
| `brand-messenger` | `#0084ff` | Messenger share                               |
| `brand-facebook`  | `#1877f2` | Facebook share                                |
| `brand-x`         | `#111111` | X share                                       |
| `brand-airbnb`    | `#e0565b` | Airbnb nights on the calendar and charts      |
| `brand-booking`   | `#2f6fd6` | Booking.com nights on the calendar and charts |

Calendar and chart colours by channel come from one file: `src/components/dashboard/channel-colors.ts`. Never pick
a channel colour anywhere else.

### 2.3 Every palette's values

You never type these values. They are here so everyone knows what each palette looks like, and so the new
`globals.css` is copied exactly. Every primary (`--accent`) keeps white text readable (4.5:1 or better) in light
mode, and dark text in dark mode.

#### Light mode

| Token             | Cedar     | Byblos    | Batroun   | Baalbek   | Jounieh   |
| ----------------- | --------- | --------- | --------- | --------- | --------- |
| `--paper`         | `#fbf8f1` | `#f9f6f0` | `#fcf7f1` | `#f8f5f1` | `#f7f8fa` |
| `--surface`       | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| `--surface-2`     | `#f3eee3` | `#f1ece2` | `#f5ebe0` | `#efe8e1` | `#eceff4` |
| `--ink`           | `#1d2a24` | `#16233a` | `#2e211b` | `#2a1c26` | `#141b2b` |
| `--ink-muted`     | `#5f6b64` | `#5a6577` | `#6f5f55` | `#6c5d66` | `#5b6475` |
| `--ink-faint`     | `#8c958f` | `#8a93a3` | `#9b8a80` | `#9a8b94` | `#8b93a3` |
| `--line`          | `#e7e0d2` | `#e6dfd2` | `#ecdccd` | `#e6dcd3` | `#e1e5ec` |
| `--line-strong`   | `#d8cfbd` | `#d6cdbd` | `#dfcab7` | `#d6c9be` | `#cfd5df` |
| `--accent`        | `#1f5c44` | `#1f3b63` | `#a8472a` | `#5c2a4d` | `#23324f` |
| `--accent-strong` | `#154532` | `#152a48` | `#84361f` | `#451f3a` | `#161f33` |
| `--accent-ink`    | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| `--glow`          | `#b8893b` | `#c2603f` | `#6d7f3b` | `#c49a3c` | `#b08a4a` |

#### Dark mode

| Token             | Cedar     | Byblos    | Batroun   | Baalbek   | Jounieh   |
| ----------------- | --------- | --------- | --------- | --------- | --------- |
| `--paper`         | `#0e1512` | `#0d1220` | `#16100d` | `#140e13` | `#0b0f18` |
| `--surface`       | `#151e1a` | `#141b2c` | `#1f1713` | `#1d151b` | `#121826` |
| `--surface-2`     | `#1d2823` | `#1c2538` | `#2a201a` | `#281d25` | `#1a2233` |
| `--ink`           | `#f1efe8` | `#f1eee8` | `#f5ede6` | `#f3ecf0` | `#eef1f6` |
| `--ink-muted`     | `#a8b1ab` | `#a7aebd` | `#b8a99f` | `#b5a6b0` | `#a3abba` |
| `--ink-faint`     | `#74807a` | `#737c8f` | `#85766c` | `#82737d` | `#707a8c` |
| `--line`          | `#26332d` | `#263048` | `#35281f` | `#33262f` | `#232c3f` |
| `--line-strong`   | `#34443c` | `#33405c` | `#463529` | `#45343f` | `#303b52` |
| `--accent`        | `#5fbf94` | `#8fb0e4` | `#e2805f` | `#cf94bb` | `#a7bde6` |
| `--accent-strong` | `#82d1ad` | `#afc6ec` | `#eca086` | `#dfb0cf` | `#c3d2ef` |
| `--accent-ink`    | `#07140e` | `#0a1426` | `#2a0e06` | `#2a0c20` | `#0b1426` |
| `--glow`          | `#d8a856` | `#e08867` | `#a9bd6a` | `#e0b75f` | `#d9b273` |

#### Status colours (the same in every palette)

| Token          | Light              | Dark                |
| -------------- | ------------------ | ------------------- |
| `--success`    | `#008a05`          | `#4ade80`           |
| `--warning`    | `#b45309`          | `#fbbf24`           |
| `--danger`     | `#c13515`          | `#f87171`           |
| `--danger-ink` | `#ffffff`          | `#1f0606`           |
| `--scrim`      | `rgb(0 0 0 / 0.5)` | `rgb(0 0 0 / 0.65)` |

### 2.4 How light, dark and the palette are applied

- The `<html>` tag gets `data-palette="cedar"` (the site's palette, from `SiteSetting`) and `data-mode="light"` or
  `"dark"`.
- A small script in `<head>` (`src/components/theme/appearance-script.tsx`) sets them before the page paints, so
  there is no flash of the wrong theme.
- The light/dark switch is in `appearance-menu.tsx`. The choice is saved in the browser.
- Dark-only styles use the `dark:` variant (`dark:bg-surface-2`), but most things need nothing: the tokens change by
  themselves.

---

## Part 3. Fonts and text

### 3.1 The four fonts

All fonts are files in `src/app/fonts/` (free licence), loaded with `next/font/local` in `src/app/layout.tsx`. We
never load fonts from Google, so the build never depends on the internet.

| Font                    | File                                | Used for                   | Class                         |
| ----------------------- | ----------------------------------- | -------------------------- | ----------------------------- |
| Inter                   | `inter-100-900.woff2`               | All reading text (English) | `font-sans` (the default)     |
| IBM Plex Sans Arabic    | `plex-arabic-400/500/600/700.woff2` | All reading text (Arabic)  | `font-sans` (the default)     |
| Archivo, stretched wide | `archivo-100-900.woff2`             | Headings (English)         | `font-display`, `font-poster` |
| Kufi                    | `kufi-100-900.woff2`                | Headings (Arabic)          | `font-display`, `font-poster` |

The browser picks the Arabic font by itself for Arabic letters, because each class lists both fonts.

### 3.2 The text sizes

| Where                                         | Classes                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Big public titles (home hero, booking page)   | `font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]` (bigger on the home page)                        |
| Dashboard and admin page title (`PageHeader`) | `text-3xl font-semibold sm:text-4xl`                                                               |
| Place page title                              | `text-[1.75rem] leading-tight font-semibold`                                                       |
| Section title on public pages                 | `text-[1.375rem] font-semibold`                                                                    |
| Section title in the dashboard (`Panel`)      | `text-xl font-semibold` (overview sections: `text-2xl`)                                            |
| Body text                                     | `text-[0.9375rem]` (inputs, buttons) or `text-base`; AI replies `text-[1.0625rem] leading-relaxed` |
| Small text, hints                             | `text-sm text-muted`                                                                               |
| Captions, labels on numbers                   | `text-xs font-semibold text-muted`                                                                 |
| Group titles (side menu, "YOUR ASSISTANT")    | `text-[0.6875rem]` or `text-xs`, `font-bold tracking-[0.12em] uppercase text-faint`                |
| Numbers in tables and tiles                   | add `tabular-nums`                                                                                 |

Rules from `globals.css`: headings use the display font with tight letter spacing; Arabic headings have no letter
spacing; emphasis in a heading (`<em>`) is the accent colour, never italics; long text uses `text-wrap: pretty`.

---

## Part 4. Spacing, sizes and layout

### 4.1 The spacing scale

Tailwind 4: one step = `0.25rem` = 4 pixels. `p-4` = 16px, `gap-6` = 24px. We use these steps:

| Step        | Pixels | Typical use                                                                |
| ----------- | ------ | -------------------------------------------------------------------------- |
| `1` / `1.5` | 4 / 6  | Space between a label and its input (`gap-1.5`)                            |
| `2` / `3`   | 8 / 12 | Icons and text, chips, list items                                          |
| `4`         | 16     | Side padding on phones (`px-4`), space inside small cards                  |
| `5`         | 20     | Inside a panel (`p-5`)                                                     |
| `6`         | 24     | Between cards in a grid (`gap-6`), page side padding from `sm:`            |
| `8`         | 32     | Under the page title (`mb-8`), between page sections on the booking page   |
| `10`        | 40     | Page side padding from `lg:` (`lg:px-10`), page top padding on big screens |
| `12`        | 48     | Between big sections on public pages (`mt-12 pt-12`)                       |

### 4.2 Page containers (copy them exactly)

| Page type                            | Container classes                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Dashboard and admin main area        | `mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10` (in `app-shell.tsx`)         |
| Public home, search, wide bands      | `mx-auto max-w-360 px-4 sm:px-6 lg:px-10`                                            |
| Place and experience pages           | `mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10`                                       |
| Place page body with booking box     | `grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20`                                     |
| Book page (form + summary)           | `mx-auto grid max-w-280 gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10` |
| Narrow pages (sign in, simple forms) | `mx-auto max-w-md px-4 pt-10`                                                        |
| Reading pages (privacy, contact)     | `mx-auto max-w-5xl px-4 pt-6 sm:px-6`                                                |

### 4.3 The app frame (dashboard and admin)

- **Side menu** (from `lg:`): `272px` wide, `bg-surface`, `border-e border-line`, sticky, full height. Groups:
  Today, AI, Bookings, Listings, Money, Team, Business (`src/components/dashboard/nav-items.ts`). The menu shows only
  the pages the member's permissions allow.
- **Top bar:** `h-16`, sticky, `bg-paper/85 backdrop-blur-xl border-b border-line`. It holds: the menu button on
  phones, the area and page name, "Ask AI", "View site", the bell, light/dark, language, and the account button.
- **Phone tab bar:** fixed at the bottom on phones (`lg:hidden`), `bg-paper/90 backdrop-blur-xl`, with the safe
  area (`pb-[env(safe-area-inset-bottom)]`). The page gets `pb-24` so nothing hides behind it.
- **Phone menu:** a drawer from the start side, `w-[86%] max-w-80`, over a `bg-ink/40` layer.
- **Back button:** `BackLink` at the top of every page (`mb-4`). It goes to the parent page.

### 4.4 Radius, shadows and motion

| Token           | Value                               | Class                  | Use                             |
| --------------- | ----------------------------------- | ---------------------- | ------------------------------- |
| `--radius-sm`   | 0.5rem                              | `rounded-sm`           | Small tags                      |
| `--radius`      | 0.75rem                             | `rounded-md`           | Copy fields, skeleton shapes    |
| `--radius-lg`   | 1rem                                | `rounded-lg`           | Buttons and inputs              |
| `--radius-xl`   | 1.5rem                              | `rounded-xl`           | Panels and cards (`panelClass`) |
| pills           | -                                   | `rounded-full`         | Chips, icon buttons, avatars    |
| `--shadow-soft` | soft                                | `shadow-soft`          | Cards that float a little       |
| `--shadow-lift` | strong                              | `shadow-lift`          | Drawers, menus, dialogs         |
| `--ease-out`    | `cubic-bezier(0.2, 0, 0, 1)`        | `ease-(--ease-out)`    | Most movement                   |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `ease-(--ease-spring)` | Small bouncy moments            |

Motion classes in `globals.css`: `rise-in` (a section fades up when it appears; set `--stagger` for lists),
`skeleton` (the loading shimmer), page changes use the browser's view transition. Everything turns off when the
person asks for reduced motion. Chat messages use `motion` (`framer-motion`) with a spring.

### 4.5 Signature shapes (the brand)

These classes give the product its Lebanese travel look. Use them where the reference project does:

- `arch` and `arch-tall`: a Lebanese doorway arch shape for photos (home hero, place art).
- `ticket-tear`: a dashed line with a half-circle bite on each side, like a boarding pass (booking summary).
- `receipt`: a torn till-receipt bottom edge (the "direct receipts" band).
- `ruled`: lines like the back of a postcard.
- `stamp-spin` with `Postmark`: a slowly turning postmark stamp.
- Components in `src/components/brand/`: `ArchWindow`, `BoardingPass`, `Postmark`, `ConciergeBand`,
  `DirectReceipts`, `AppIcon`.

---

## Part 5. Icons and images

- Icons: `lucide-react` only. Size `size-4` in buttons and small text, `size-5` in the top bar and menus. Always
  `aria-hidden` when there is a text label next to the icon; otherwise give the button an `aria-label`.
- Photos: stored by our server (`/api/images/{id}`), shown with `next/image`, always with `alt` text and a fixed
  aspect ratio so the page does not jump while loading.

---

## Part 6. The shared components

Each one lives in the same file as in the reference project. Use them; never copy their classes into a new
component.

### 6.1 Buttons: `src/components/ui/button.tsx`

`Button` (a `<button>`), `ButtonLink` (a link that looks like a button), and `buttonClass()` for the rare case where
you need the classes.

| Variant             | Classes                                                  | Use                               |
| ------------------- | -------------------------------------------------------- | --------------------------------- |
| `primary` (default) | `bg-accent text-accent-ink hover:bg-accent-strong`       | The one main action on a screen   |
| `secondary`         | `bg-surface text-ink ring-1 ring-ink hover:bg-surface-2` | Other actions                     |
| `ghost`             | `text-ink hover:bg-surface-2`                            | Quiet actions in rows and menus   |
| `danger`            | `bg-danger text-danger-ink hover:brightness-110`         | Cancel a booking, delete, decline |

| Size           | Classes                                       |
| -------------- | --------------------------------------------- |
| `sm`           | `h-9 px-3.5 text-sm gap-1.5 rounded-lg`       |
| `md` (default) | `h-11 px-5 text-[0.9375rem] gap-2 rounded-lg` |
| `lg`           | `h-12 px-6 text-base gap-2 rounded-lg`        |
| `icon`         | `size-10 rounded-full justify-center`         |

All buttons: `font-semibold`, shrink a little when pressed (`active:scale-[0.98]`), `disabled:opacity-40`.

### 6.2 Form controls: `src/components/ui/field.tsx`

| Name                   | What it is                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Field`                | A label, an input, and a hint or error under it. Use it for every text input.                                                                                   |
| `TextArea`             | The same for long text (`min-h-28`).                                                                                                                            |
| `LabeledControl`       | A label around any control (select, date, checkbox group).                                                                                                      |
| `inputClass`           | `h-12 w-full rounded-lg bg-surface px-4 text-[0.9375rem] ring-1 ring-line-strong`, focus `ring-2 ring-ink`, error `ring-danger`. For selects and custom inputs. |
| `labelledControlClass` | A small caption over a compact input, for inline forms (prices, sessions).                                                                                      |
| `panelClass`           | `rounded-xl bg-surface p-5 ring-1 ring-line`. A raised card.                                                                                                    |
| `choiceChipClass`      | A pill around a hidden checkbox or radio; it fills with `accent-soft` when checked.                                                                             |

Other controls in `src/components/ui/`: `DateRangePicker`, `GuestCounter`, `CopyField` (a value with a copy
button), `Rating` (stars).

### 6.3 Messages and states

| Component                      | File                                      | Use                                                                             |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `FormError`                    | `ui/form-error.tsx`                       | A calm error message for a whole form (`role="alert"`)                          |
| `LoadingStatus`                | `ui/loading-status.tsx`                   | "Loading…" text for screen readers and slow parts                               |
| `Skeleton`                     | `ui/skeleton.tsx` + `shell/skeletons.tsx` | Grey shapes that match the real layout while loading                            |
| `useConfirm` / `ConfirmDialog` | `ui/confirm-dialog.tsx`                   | The "Are you sure?" step before any change that cannot be undone                |
| `SheetDialog`                  | `ui/sheet-dialog.tsx`                     | A dialog that is a full-screen sheet on phones and a centred box on big screens |
| `ShowAllDialog`                | `ui/show-all-dialog.tsx`                  | "Show all photos / reviews / amenities"                                         |

### 6.4 Page structure

| Component                               | File                      | Use                                                                                                                              |
| --------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`                              | `shell/app-shell.tsx`     | The dashboard and admin frame (Part 4.3)                                                                                         |
| `PageHeader`                            | `shell/page-header.tsx`   | The title block of every dashboard and admin page: a small `glow` bar, the title, an intro, and actions on the end side. `mb-8`. |
| `Panel`                                 | `shell/page-header.tsx`   | A titled card on a dashboard page (`panelClass` + `text-xl` title + optional intro and action)                                   |
| `BackLink`                              | `shell/back-link.tsx`     | The Back button                                                                                                                  |
| `Pagination`                            | `shell/pagination.tsx`    | Page numbers for long lists                                                                                                      |
| `NotificationBell`, `NotificationList`  | `shell/`                  | The bell (latest 5) and the full list                                                                                            |
| `StatTile`                              | `dashboard/stat-tile.tsx` | One number with its label (percent, count or money)                                                                              |
| `BarChart`, analytics charts            | `dashboard/`              | Charts, coloured with tokens and `channel-colors.ts`                                                                             |
| `SiteHeader`, `SiteFooter`, `SearchBar` | `site/`                   | The public site's header, footer and search                                                                                      |

### 6.5 AI components: `src/components/assistant/`

`ChatPanel` (the chat list and input), `TeamAssistant` (owner), `Concierge` (guest), `ActionCard` (the "waiting for
you to confirm" card), `RichText` (renders AI replies: paragraphs, **bold**, lists and tables; never HTML).

---

## Part 7. The four states of every screen

1. **Loading:** a `loading.tsx` next to the page, built from `Skeleton` shapes that match the real layout (same
   columns, same card sizes). Buttons that are working show a short "Saving…" text and are disabled.
2. **Empty:** a short sentence that says what is missing and what to do next, with one button. Example: "No bookings
   yet. Share your booking link to get the first one." Never an empty white area.
3. **Error:** a calm message next to the field that is wrong (`Field` with `error`), or `FormError` for the whole
   form. Never a raw error, a stack trace or a code. Server errors come back as translated messages.
4. **Normal:** the page as described in Part 8.

Also, on every screen: a visible focus ring (`:focus-visible` uses `--ink`), every button reachable with the
keyboard, every input with a label, and no sideways scroll at 390 pixels.

---

## Part 8. Every page and its sections

The id after each page is the task in `01-team-plan.md` that builds it. Sections are listed from top to bottom.
Changes for the new project (from `06-functional-requirements.md`) are marked **New:**.

### 8.1 Public site (header and footer from `SiteHeader` and `SiteFooter`)

#### `/` Home (5C)

1. **Hero:** a two-column band (`lg:grid-cols-[1.1fr_1fr]`). Start side: a `font-poster` title, a short line, and
   the `SearchBar` (where, dates, guests). End side: `ArchWindow` photo with a `BoardingPass` and a `Postmark`.
2. **Browse:** the `Browse` component without its own search: category bar (`CategoryBar`), tabs for stays,
   experiences and services (`ListingTabs`), and the results grid (`ResultsGrid` of `PlaceCard`s).
3. **Direct receipts** (`DirectReceipts`): what a guest pays on Airbnb or Booking.com compared with booking direct.
4. **Concierge band** (`ConciergeBand`): an invitation to ask the trip concierge.

#### `/search` Search (5C)

`Browse` with its search bar and the filters dialog (`FiltersDialog`: price, categories, amenities,
accessibility). Filters live in the web address, so a search can be shared. Results as a grid of cards.

#### `/p/[slug]` Place page (2C, full in 6C)

1. **Title row:** place name (`text-[1.75rem]`), rating, area, and on the end side `ShareButton` and
   `FavoriteButton`.
2. **Gallery:** the photo grid with "Show all photos".
3. **Body** (`lg:grid-cols-[1fr_380px]`). Start column:
   - `ListingSummary`: guests, bedrooms, beds, baths, rating and who hosts it.
   - The description.
   - Rooms (for room-by-room places), each with photos, capacity and price.
   - `PhotoTour` (photos grouped by room) with a link to the full tour.
   - Amenities (6 shown, then "Show all amenities" in a `ShowAllDialog`).
   - `ReviewList`.
   - "Where you'll be": `PlaceMap`.
   - `MeetHost`: the host's name, years hosting, response rate and time, and Contact host.
   - `ThingsToKnow`: check-in, check-out, house rules, and "Cancellation". Cancellation shows the refund rule only
     ("Online payments are always refunded in full"); there is no free-text cancellation policy to show.

   End column: the sticky `BookingWidget` (dates, guests, nightly price and total, the Book button).

4. On phones the booking box becomes a bar fixed at the bottom with the price and the button.

**New:** no deposit and no refund policy in the booking box. It says how this place works in one line (the mode):
"Pay online, confirmed at once", "Pay online, the host confirms", or "Arrange payment with the host".

#### `/p/[slug]/photos` Photo tour (6C)

Photos grouped by area and room, with a Back button to the place.

#### `/p/[slug]/book` Book (4C)

Two columns (`lg:grid-cols-[1fr_400px]`). Start: `GuestDetailsForm` (name, phone, email, number of guests, a note).
End: a `BoardingPass` summary (place, room, dates, nights) with the `PriceBreakdown`.

**New:** the button is "Book and pay" (modes 1 and 2) or "Send request" (mode 3). There is no deposit line: the total
is what is paid.

#### `/p/[slug]/contact` Contact host (7C)

1. Title and the host's usual response time.
2. "What guests usually ask": getting there, price and availability (the full price is paid; no deposit), the
   refund rule, house rules.
3. "Still have questions?": `ContactHostForm` and the WhatsApp button, depending on the host's choice.

#### `/b/[token]` The guest's booking page (4C; the pay buttons are 4A)

1. **Title** (`font-poster`) and a numbered step bar (sent, paid, confirmed) with check marks for done steps.
2. **Pay** (online modes, while not paid): "Pay {amount}", the `HoldCountdown` (10 minutes), and `PayOnline`
   (Whish and card buttons).
3. **Waiting for the host** (mode 2 after paying, or mode 3) with the `HoldCountdown` of the host's answer time.
4. **Contact:** the WhatsApp button to the host.
5. **Phone alerts** (`PhoneAlerts`) to follow this booking.
6. `GuestCancelButton` ("Cancel my booking").
7. The `BoardingPass` with the booking details and a `Postmark`.

**New:** no "Deposit: {amount}" line; the amount is always the full total. A cancelled paid booking says "Refunded
in full".

#### `/o/[slug]` Experience or service (B2, bonus)

Like the place page: title row, gallery, summary, what is included, `ThingsToKnow`, "Where you meet" map,
`MeetHost`, reviews, and the `SessionBookingCard` (pick a session and seats) on the end side. `ThingsToKnow`'s
"Cancellation" is the same refund rule as the place page (an experience has no "cancel up to N hours" setting).
The card shows the total, which is what is paid: no deposit line.

#### `/assistant` Trip concierge (B3, bonus)

The `Concierge` chat with idea tickets to start, place cards under answers, and a section "Use it from Claude or
ChatGPT" with the guest MCP address in a `CopyField`.

#### `/pricing` Plans (B1, bonus)

`PlanCards`: Free, Pro, Business with their limits and the button for each.

#### `/privacy`, `/offline`, not found and error pages (1B; privacy 2B)

Plain reading pages. The privacy page also holds the payment policy (online refunds are always full; offline
payments are between the host and the guest). `/offline` shows `HeroLandscape` and "You're offline".

### 8.2 Sign in and accounts (2B)

All use `AuthPage` (a narrow centred card, `max-w-md`) with `AuthForm`:

- `/sign-in`: email, password, "Forgot password?", link to sign up.
- `/sign-up`: name, email, password; then "check your email".
- `/forgot-password` and `/reset-password`: one field each.
- `/home`: no screen; it sends owners to their dashboard and guests to the home page.
- `/host`: "Create your workspace" (`CreateWorkspaceForm`: the place's name and area).
- `/oauth/consent` and `/oauth/workspace` (B4): "Allow {app} to connect?" and "Which workspace?" when Claude or
  ChatGPT connects.

### 8.3 Guest account (4C; notifications 7B; favourites and reviews B6)

Tabs at the top (`AccountTabs`):

- `/account`: your trips (upcoming and past), and a review form after check-out (one overall star rating and a
  comment; no separate cleanliness, location or value ratings).
- `/account/favorites`: a `PlaceGrid` of saved places.
- `/account/activity`: what you did, newest first.
- `/account/notifications`: notifications on this device (`PhoneAlerts`).
- `/account/privacy`: download or delete your data (`PrivacyControls`).

### 8.4 Host dashboard (`AppShell`, every page starts with `PageHeader`)

| Page                       | Task       | Sections, top to bottom                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard` All my places | 8B         | `PageHeader` "All my places"; one card per place: arrivals today, requests waiting, money                                                                                                                                                                                                                                                                       |
| `/dashboard/[id]` Today    | 8B         | 4 `StatTile`s (occupancy, direct revenue, commission saved, nights sold); the savings panel (revenue, commission saved, plan fees, kept); requests waiting (`BookingRow`s, waiting first); nights by month (`BarChart`) and channels (`ShareBar`) side by side                                                                                                  |
| `/analytics`               | 8B         | Filters (period, one place or all); `StatTile`s; nights, revenue, channels and requests charts; a per-place table; the AI report (`ReportGenerator`, W)                                                                                                                                                                                                         |
| `/bookings`                | 4B         | Stays and experience sessions, waiting ones first. Each `BookingRow` shows the guest, room, dates, total, status and countdown, with `BookingActions` on the row: Confirm and Decline (modes 2 and 3), Cancel (every mode), each with `useConfirm`. There is no separate booking page.                                                                          |
| `/calendar`                | 5B         | `CalendarBoard`: month, week and rooms views; the side panel for the chosen day; `CloseDatesForm`. A platform booking that clashes with ours has a red outline and a note in the side panel; it is never cancelled from here                                                                                                                                    |
| `/channels`                | 6A         | Each room's export link (`CopyField`); connected Airbnb, Booking.com or other links with last sync and error (`FeedButtons`: Sync now, Remove); `AddFeedForm`                                                                                                                                                                                                   |
| `/place` Your place        | 9B         | `PlaceEssentials` (description, rules, photos by area), whole place or by room, `PhotoManager`                                                                                                                                                                                                                                                                  |
| `/rooms`                   | 3B         | Each room in a `RoomEditor` with `PhotoManager` and `SpecialPrices`; "Add a room"                                                                                                                                                                                                                                                                               |
| `/offerings`               | B2 (bonus) | `OfferingEditor`, `PhotoManager`, `SessionScheduler`. No cancellation-hours field                                                                                                                                                                                                                                                                               |
| `/reviews`                 | B6 (bonus) | Average rating; each review with `ReviewControls` (reply, hide with a reason)                                                                                                                                                                                                                                                                                   |
| `/payouts`                 | 8A         | `StatTile`s (available, upcoming, paid out); `PayoutRequestForm`; payout history; online payments                                                                                                                                                                                                                                                               |
| `/billing`                 | B1 (bonus) | Current plan, `PlanCards`, `UpgradeButton`, `WhishPlanButton`                                                                                                                                                                                                                                                                                                   |
| `/team`                    | 6B         | Members (`MemberControls`, `AddMemberForm`) and roles (`RoleEditor`)                                                                                                                                                                                                                                                                                            |
| `/assistant`               | 9A         | `TeamAssistant`: New chat, History, Temporary chat; the chat; `ActionCard`s under replies                                                                                                                                                                                                                                                                       |
| `/keys`                    | B4         | `KeyManager` (create, list, revoke keys; how to connect Claude, Cursor or Codex) and the audit list                                                                                                                                                                                                                                                             |
| `/settings`                | 3C         | `SettingsForm`: contact, currency, commission rate, owner's answer time, listed or not, house rules, and how guests pay you directly (`paymentInstructions`, for offline mode). No cancellation policy field: the refund rule is the only one. **New:** the booking mode (3 choices as large radio cards) and accepting the payment policy for the online modes |
| `/profile`                 | 7C         | `ProfileForm`, `HostProfileForm` (bio, city, languages, how guests reach you, show or hide; no phone or WhatsApp: guests use the business's numbers), `PasswordForm`                                                                                                                                                                                            |
| `/notifications`           | 7B         | `PhoneAlerts`, `NotificationList`, `Pagination`. Includes calendar clashes (new and cleared), linking to `/calendar`                                                                                                                                                                                                                                            |

### 8.5 Platform admin (`AppShell` in admin mode) (B9, bonus; the money page 8A)

| Page                                       | Sections                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                   | Overview `StatTile`s (businesses, users, bookings in 30 days, earned this month); "Needs attention"; newest businesses                                                                |
| `/admin/hosts` and `/admin/hosts/[userId]` | All hosts; one host's profile and their businesses with `BusinessStatusToggle` and "Open"                                                                                             |
| `/admin/users`                             | All users                                                                                                                                                                             |
| `/admin/categories`                        | `CategoryManager`                                                                                                                                                                     |
| `/admin/appearance`                        | `SitePalettePicker`: the 5 palettes, light and dark preview                                                                                                                           |
| `/admin/health`                            | Calendar sync health and AI spending                                                                                                                                                  |
| `/admin/money` (8A)                        | Earned from plans (all, this month, card, Whish), revenue by month, payouts to send (`PayoutDecision`), what is owed to hosts, refunds to send by hand (`RefundSent`), recent payouts |
| `/admin/notifications`, `/admin/profile`   | Same as the dashboard's                                                                                                                                                               |

### 8.6 Whish simulator (4A)

`/whish-simulator/pay/[code]`: the page our Whish simulator shows instead of Whish's: the amount and "Pay" or
"Cancel" (`WhishSimulatorForm`). It looks plain on purpose, like a payment provider's page.

---

## Part 9. Checklist before you open a pull request for a screen

- [ ] Only tokens, no hex or Tailwind colour names.
- [ ] Only shared components for buttons, inputs, cards and dialogs.
- [ ] `start`/`end` classes only; checked in Arabic (right-to-left).
- [ ] Checked in light and dark, and with at least two palettes.
- [ ] Checked at 390 pixels wide: no sideways scroll, nothing hidden behind the tab bar.
- [ ] Loading, empty and error states done.
- [ ] Every text in `en.json`, `ar.json` and `ar-LB.json`.
- [ ] Every input has a label; every icon button has an `aria-label`; the keyboard reaches everything.
- [ ] It looks the same as the same page in the reference project (compare side by side).
