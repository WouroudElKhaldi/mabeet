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
   code, `rgb()`, or a Tailwind colour like `bg-gray-100` or `text-green-700` in a component. Tailwind's own colours are
   switched off in `globals.css` (`--color-*: initial`), so `bg-gray-100` does nothing: a wrong class shows up at once.
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

The accent's tint (`--accent-soft`) and its border (`--accent-line`) are not in the tables: `globals.css` derives them
from each palette's `--accent` and `--surface` (`color-mix`, 12% and 35%), so a palette only chooses its accent. The
status colours and `--scrim` are in the `:root` block (light) and the `:root[data-mode="dark"]` block (dark).

### 2.4 How light, dark and the palette are applied

- The `<html>` tag gets `data-palette="cedar"` and `data-mode="light"` or `"dark"`. `layout.tsx` reads the palette
  with `getSitePalette()` (`@/modules/admin/server`): the platform admin's choice (`SiteSetting`, F16), or
  `DEFAULT_PALETTE` when none is saved or the saved value is not a palette.
- A small script in `<head>` (`src/components/theme/appearance-script.tsx`) sets `data-mode` before the page paints, so
  there is no flash of the wrong theme: the visitor's saved choice (`localStorage`, key `mabeet-mode`), else the
  device's setting.
- `AppearanceMenu` (`src/components/theme/appearance-menu.tsx`) is two round icon buttons for the top bar, as in the
  reference project: the light/dark switch (the sun and moon turn as they swap, and the page cross-fades) and the
  language menu (a globe that opens a small list of `appearance.languageNames`, the current one ticked). The switch
  reads and writes `data-mode` on `<html>` and saves the choice in the browser; until the visitor chooses, the page
  follows the device when its setting changes. The language list calls the `setLocale` server action, which also
  saves a signed-in person's language on their account, so their emails follow it.
- `dark:` follows `data-mode` (`@custom-variant` in `globals.css`), and native controls (scrollbars, an open select)
  follow it too (`color-scheme`). Most things need no `dark:` at all: the tokens change by themselves.

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
  area (`pb-[env(safe-area-inset-bottom)]`). The page gets `pb-24` so nothing hides behind it. A menu with no tab
  pages (all of someone's places) has no bar: the top bar's menu button opens the same drawer.
- **Phone menu:** a drawer from the start side, `w-[86%] max-w-80`, over a `bg-ink/40` layer.
- **Back button:** `BackLink` at the top of every page (`mb-4`). It goes to the parent page.

How a page uses the frame (`src/components/shell/app-shell.tsx`): the layout builds the menu, already filtered by the
member's permissions (`can(ctx, ...)`) and already translated, and passes it in:

```tsx
const nav: NavGroup[] = [
  {
    label: t("today"),
    items: [{ href: base, label: t("overview"), icon: "overview", end: true, tab: true }],
  },
  { label: t("listings"), items: [{ href: `${base}/rooms`, label: t("rooms"), icon: "rooms", tab: true }] },
];
return <AppShell nav={nav}>{children}</AppShell>;
```

- The host dashboard's layout (`src/app/dashboard/[businessId]/layout.tsx`) builds this from `DASHBOARD_PAGES` in
  `src/components/dashboard/nav-items.ts`: one line per page, added in the pull request that adds the page, with its
  group, path, icon and the permissions that open it (`anyOf`). The page opens with
  `requirePageAccess(businessId, DASHBOARD_PAGES.<page>.anyOf)`, so the menu never offers a page that answers 404.
- An item has `href`, `label`, `icon` (a name from `nav-icons.ts`: add one there if a page needs another), `end` (on only
  for exactly this address: the menu's home page) and `tab` (also in the bar at the bottom of a phone; the first four
  marked, the rest are behind "More"). The page being shown is marked from the address, and the top bar names it.
- `area="admin"` is the platform admin area, and `adminVisiting` adds the "Platform admin" badge when an admin is in
  someone else's business. The frame adds `BackLink` above the page, and `pb-24` on phones so nothing hides behind the bar.
- The top bar has the area and page name, "View site", the theme and language menu, and the member's initial with
  "Sign out" (in the drawer on phones). The bell and "Ask AI" join it with notifications (F14a) and the assistants.

### 4.4 Radius, shadows and motion

| Token           | Value                               | Class                  | Use                             |
| --------------- | ----------------------------------- | ---------------------- | ------------------------------- |
| `--radius-sm`   | 0.5rem                              | `rounded-sm`           | Small tags                      |
| `--radius-md`   | 0.75rem                             | `rounded-md`           | Copy fields, skeleton shapes    |
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

Depth and movement on the brand art (beyond the reference project, asked for on 2026-11-01):

- `rise-in-sequence` on a form: its fields rise one after another, after the heading.
- `float`: a slow hover for a card in front of the brand art (the boarding pass). It moves `translate`, so it adds to
  the card's own rotation and depth.
- `BrandScene`, `SceneLayer` and `Sheen` (`src/components/brand/brand-scene.tsx`): the brand art as a small 3D scene.
  The group leans toward the mouse wherever it is on the page (a spring, up to 10 degrees), and sways slowly by
  itself when the mouse is still. Each `SceneLayer` has a `depth` in pixels: the deeper toward the viewer, the further
  it slides, so the boarding pass moves more than the window behind it. Inside the arches, `PlaceArt`'s sun and two
  hills slide by their own distance too (they read `--px` and `--py`, from -1 to 1, which the scene sets). `enter`
  choreographs the opening: the window rises (`rise`), the pass drops in with a spring (`drop`), the postmark lands
  like a stamp (`stamp`). `Sheen` is light sliding across the pass as it turns. Used on the sign-in brand panel and
  the home hero. Touch screens get only the sway and the opening; reduced motion gets none of it.

### 4.5 Signature shapes (the brand)

These classes give the product its Lebanese travel look. Use them where the reference project does:

- `arch` and `arch-tall`: a Lebanese doorway arch shape for photos (home hero, place art).
- `ticket-tear`: a dashed line with a half-circle bite on each side, like a boarding pass (booking summary).
- `receipt`: a torn till-receipt bottom edge (the "direct receipts" band).
- `ruled`: lines like the back of a postcard.
- `stamp-spin` with `Postmark`: a slowly turning postmark stamp.
- Components in `src/components/brand/`: `ArchWindow`, `BoardingPass`, `Postmark`, `ConciergeBand`,
  `DirectReceipts`, `AppIcon`.

The logo (`docs/brand/mabeet-logo.png`, the arch opening onto a landscape above "Mabeet") is used two ways:

- `Wordmark` (`src/components/site/wordmark.tsx`), in the header, footer and sign-in pages: its arch, landscape and
  name are masks cut from the logo (`public/brand/mabeet-arch.png`, `mabeet-scene.png`, `mabeet-word.png`), filled
  with the palette's accent (the landscape lighter), so every palette, light and dark, wears its own logo. It reads
  left to right in every language.
- The browser tab and home-screen icons: the emblem in the site palette's accent on its paper, one set per palette in
  `public/brand/icons/<palette>/` (`favicon.ico`, `icon.png`, `apple-icon.png`). `layout.tsx` names the set of the
  palette the admin chose, and `/favicon.ico` sends there too. `pnpm brand:assets` (`scripts/brand-assets.ts`) makes
  the masks and every palette's icons from the logo and the palettes in `globals.css`: run it after changing the logo
  or adding or changing a palette.

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

Other controls in `src/components/ui/`: `CopyField` (a value with a copy
button), `Rating` (stars), `ChoiceChips` (one choice among a few, as `choiceChipClass` radios with a legend),
`ChoiceLinks` (the same chips, but each choice is its own address, such as `?plan=PRO`), `StepTrail` (the numbered
steps of a short process, the current one filled), `CheckList` (what is included, ticked, and what is not, dimmed),
`Pill` (a small label beside a title: `accent` or `quiet`), `ArrowLink` (an underlined link with an arrow that
follows the reading way), `StepList` (how to do something, as numbered steps under a small title), and the two pickers below. In
`src/components/brand/`: `TicketCard` (a public page's one form dressed as a ticket,
like `BoardingPass`: the title in the accent band with `LogoMark`, a stub, the tear line, then the form).

**`DateRangePicker`** (`date-range-picker.tsx`). A button with two cells (check-in, check-out) that opens a dialog with
one month and previous/next buttons; a full-screen sheet on phones, a centred box on bigger screens. Nothing changes
until "Apply"; Esc or the close button cancels, and "Clear" then "Apply" means "no dates".

| Prop                | What it does                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `value`, `onChange` | `{ checkIn, checkOut }` as ISO dates (`"2026-11-14"`) or `null`. A value that does not fit is shown, then dropped on open |
| `takenNights`       | ISO dates somebody else has or the host closed. They cannot be slept, but a guest can leave on the morning one begins     |
| `minNights`         | The room's minimum stay. A check-in without enough free nights after it is not offered                                    |
| `maxNights`         | The longest stay (the booking service refuses more than 60 nights; pass it so the calendar refuses first)                 |
| `maxDate`           | The last possible check-out. Two years from today by default                                                              |
| `timeZone`          | Decides what "today" is. Beirut by default (`DEFAULT_TIME_ZONE` in `src/config/time.ts`); pass `Business.timezone`        |

The rules of choosing live in `src/utils/stay-selection.ts` and the month grid in `src/utils/calendar-grid.ts`, both pure
and tested; the component only draws them. It works with the keyboard (arrows, Page Up/Down, Home/End, Enter), the
arrows flip on an Arabic page, and the week starts on Monday. Put it inside `LabeledControl` or pass `aria-invalid` and
`aria-describedby` to it for an error.

**`GuestCounter`** (`guest-counter.tsx`). A number between "−" and "+". `max` is the room's capacity (required), `min` is one by default. A value that does not fit (the guest picked 6, then chose a room for 4) is shown as the nearest one that does, and
`onChange` is called once with it, so what the guest sees is what is sent.

Buttons that reach a limit use `aria-disabled`, not `disabled` (`Button` styles both the same): a disabled button throws
the keyboard focus away.

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

| Component                                           | File                    | Use                                                                                                                                |
| --------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`                                          | `shell/app-shell.tsx`   | The dashboard and admin frame (Part 4.3)                                                                                           |
| `PageHeader`                                        | `shell/page-header.tsx` | The title block of every dashboard and admin page: a small `glow` bar, the title, an intro, and actions on the end side. `mb-8`.   |
| `Panel`                                             | `shell/page-header.tsx` | A titled card on a dashboard page (`panelClass` + `text-xl` title + optional intro and action)                                     |
| `BackLink`                                          | `shell/back-link.tsx`   | The Back button                                                                                                                    |
| `Pagination`                                        | `shell/pagination.tsx`  | Page numbers for long lists                                                                                                        |
| `NotificationBell`, `NotificationList`              | `shell/`                | The bell (latest 5) and the full list                                                                                              |
| `StatTile`                                          | `ui/stat-tile.tsx`      | One number with its label (percent, count or money); a long number shrinks to the tile's width (`cqi`) instead of being cut        |
| `BarChart`, analytics charts                        | `dashboard/`            | Charts, coloured with tokens and `channel-colors.ts`                                                                               |
| `SiteHeader`, `SiteFooter`, `SearchBar`, `SiteMenu` | `site/`                 | The public site's header, footer and search, and the header's menu on phones                                                       |
| `NavLink`, `LogoMark`                               | `site/`                 | A header link with the glow bar on hover and on the current page; the logo's arch alone, in the text colour                        |
| `Section`, `ExamplePrompt`                          | `site/`                 | A titled part of a public page; something to try typing into an AI app, shown as a chat message                                    |
| `StoryRail`, `StoryChapter`                         | `site/`                 | One journey line through a long page, filling as you scroll with the Mabeet mark travelling; a chapter with its stop on it         |
| `StatBand`, `BigStat`, `Journey`                    | `site/`                 | A dark band of striking figures; one figure (put a `CountUp` in it); a path of numbered stops on a dashed line that draws itself   |
| `Eyebrow`, `LandscapeBand`                          | `site/`                 | The tinted pill above a big title; the closing band with Mount Lebanon behind a title and actions                                  |
| `WhatsAppLink`, `CountUp`, `Reveal`                 | `site/`, `ui/`          | A button opening a WhatsApp chat; a number that counts up when seen; plays its children's motion once when scrolled into view      |
| `TopicCard`, `OnThisPage`                           | `site/`                 | A numbered topic card that leans in 3D (glow bar, filled tile on hover); links to a long page's sections                           |
| `TiltCard`, `ReceiptCard`                           | `brand/`                | Any card leaning toward the mouse in 3D (`--px`/`--py` for `Sheen`); promises on a till receipt in a `BrandScene`, with a postmark |
| `PageIntro`, `PageNote`                             | `site/page-intro.tsx`   | A public page's centred poster title and line; the small print at its end                                                          |
| `HeroHeading`, `IconPoints`                         | `site/`                 | The big title and intro of a page that sells something; reasons with an accent icon, two to a row                                  |
| `PlanCards`, `PlanPicker`                           | `billing/`              | The three plans side by side; the plan to start on, picked in place as `ChoiceLinks`, with its price and limits                    |

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

The id after each page is its requirement in `06-functional-requirements.md`. Sections are listed from top to bottom.
Changes for the new project (from `06-functional-requirements.md`) are marked **New:**.

### 8.1 Public site (header and footer from `SiteHeader` and `SiteFooter`)

The header's end side: "Become a host", the appearance menu, then the account avatar (or Sign in). For someone who
works in a place (owner, admin or staff), "Become a host" gives way to **Dashboard** (`/dashboard`, which opens the one
place or all of them), shown on a phone as its icon alone.

The header's links are Explore, Trip Assistant, Pricing, About us and Contact us. Below `xl:` (1280px) the header has no room for them: a menu button (`SiteMenu`, `src/components/site/site-menu.tsx`) at
the end opens a drawer from the start side (`SheetDialog placement="start"` with `NavLinks`, as the dashboard's phone
menu), with the pages grouped like the footer (Guests: Explore, Trip Assistant; Hosts: Become a host or Dashboard,
Pricing; Mabeet: About us, Contact us) and light/dark and the language, which leave the header on a phone to make room for the button.

#### `/` Home (F1)

1. **Hero:** a two-column band (`lg:grid-cols-[1.1fr_1fr]`). Start side: a `font-poster` title, a short line, and
   the `SearchBar` (where, dates, guests). End side: `ArchWindow` photo with a `BoardingPass` and a `Postmark`.
2. **Browse:** the `Browse` component without its own search: category bar (`CategoryBar`), tabs for stays,
   experiences and services (`ListingTabs`), and the results grid (`ResultsGrid` of `PlaceCard`s).
3. **Direct receipts** (`DirectReceipts`): what a guest pays on Airbnb or Booking.com compared with booking direct.
4. **Use it from your AI app** band (F6): one line on asking Claude or ChatGPT for free places, and a `ButtonLink`
   to `/assistant` (the MCP page; there is no chat on the website).

#### `/search` Search (F1)

`Browse` with its search bar and the filters dialog (`FiltersDialog`: price, categories, amenities,
accessibility). Filters live in the web address, so a search can be shared. Results as a grid of cards.

**Built so far** (home and `/search`, both reading `searchPlaces` from `directory/server` and the place categories from
`listCategories("HOME")`): `Browse` (`src/modules/directory/components/`) is the categories, the filters and the
grid, with `variant` "home" (a short row and "See all") or "search" (its own search bar and the count found).
`CategoryBar` (icons from `src/config/category-icons.ts`, in a `ScrollRail` from `components/ui`), `FiltersDialog`,
`PlaceCard` (photo, first category, town, the stay's total with dates or the night's price without) and
`ResultsGrid`. `SearchBar` (`components/site`) is the pill: where (popular towns under it), when (the
`DateRangePicker` in its `bare` look) and guests (a `GuestCounter` under it), then the round search button; when the
bar itself is narrower than 32rem (a phone, or the home hero's column on a small laptop: a container query) its parts
stack in one card. Every link is built by `searchHref` (`src/lib/search-url.ts`) and read back by
`searchParams` (`directory/schemas.ts`). The home page's bands are `DirectReceipts` and `AiAppBand`
(`components/brand`: the sample postcard, the places a real search for it finds, and a button to `/assistant`).
Experiences and services have no tab yet: they come with their module (F8).

#### `/p/[slug]` Place page (F2)

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

   - **New: "Near your stay"** (F22, under "Where you'll be"): once dates are picked, `NearbySection` shows
     experiences and services in the same region with a session during those nights, nearest first, as `PlaceCard`s
     in a row that scrolls sideways inside itself on phones (the page never does). With F23, sponsored offerings and
     partner places come first, each with a small "Sponsored" label on the card (`bg-accent-soft ring-1 ring-accent-line`, the tokens for highlights); a partner card shows its photo, kind, distance and
     its link or phone. Empty state: the section is not shown.

   End column: the sticky `BookingWidget` (dates, guests, nightly price and total, the Book button).

4. On phones the booking box comes after the text, and a bar held at the bottom shows the price and the button.

**New:** no deposit and no refund policy in the booking box. It says how this place works in one line (the mode):
"Pay online, confirmed at once", "Pay online, the host confirms", or "Arrange payment with the host".

**Built so far** (`src/modules/directory/components/`, the page is `src/app/(site)/p/[slug]/page.tsx` with its `loading.tsx`):
`PlaceView` puts the page together from a `PublicPlace` (`types.ts`); it is made of `PlaceHeader`,
`PhotoGallery` (one large and four small photos, the large one alone on a phone or with fewer than five photos, "Show all photos" in a dialog, a drawn
postcard when there are none), `PlaceSummary`, `UnitList` (the rooms, with the rooms of a place booked whole shown
without a price), `AmenityList` (Omar's `AMENITIES` list and its `placePage.amenity.*` texts; six, then "Show all"),
`ThingsToKnow`, `MeetHost`, `PlaceMap` and `BookingBox`. Not built yet: reviews, favourite, and "Near your stay".

The title row carries `ShareButton` (`src/components/site/share-button.tsx`, shared with any page that wants it) on
the end side: it opens the phone's own share sheet where there is one, otherwise it copies the link and says
"Copied". Both can be refused — the guest closes the sheet, the browser keeps the clipboard shut — and then it
claims nothing.

`PlaceMap` (the `where` section, "Where you'll be", between the amenities and the host) is the area's name and a
Google Maps embed centred on the place's coordinates, with no pin on a door: the coordinates are the host's own and
are often no more than their town, so the page says the area is approximate and the exact address comes with the
booking. The embed needs no key, and `frame-src` in `next.config.ts` already allows `maps.google.com` and nothing
else. A place whose host gave no coordinates shows no section at all, not an empty map.

The gallery's "Show all 11 photos" is a link to the photo tour (it was a dialog of the place's own photos; the tour
shows the rooms' photos too, grouped, which is what the guest wanted).

`MeetHost` (the `host` section, between the amenities and the things to know) is who hosts this place: the arch
avatar with their first letter and their name (the place's name while their profile is hidden, so no line is empty),
the languages they speak, "New on Mabeet" in their first year, then the two figures guests weigh a host by (years
hosting, response rate) and how quickly they answer as a sentence of its own ("Responds within an hour"). A figure
nobody can know yet is simply not shown, never a 0 or a dash. Then their bio, "Contact host" and the WhatsApp
button, each shown only if the host takes questions that way (`HostProfile.contactBy`), and the line asking the
guest to book and pay through Mabeet. The WhatsApp number is the place's own, never the host's.

`BookingBox` (a client component) holds the room, the dates and the guests; it asks the quote route when both dates are
picked (`useLiveQuery`, so a late answer to old dates is never shown), and shows the price, or the reason the stay
cannot be booked (a code turned into a sentence by `booking.issues.*`), or a calm error with "Try again". "Book" is a
link to `/p/{slug}/book?room=&guests=&checkIn=&checkOut=`, which the book page reads. It also reads the room's taken
nights for the year ahead (the availability route) and shows them as taken in the calendar; a stay that crosses one
(the room was switched, or somebody booked meanwhile) says "Those nights are taken" and cannot be booked. It takes `initial` (the room,
dates and guests of the page's address) and sends only a stay that fits: the calendar drops anything that does not.
On a phone a bar held at the bottom shows the "from" price and leads to the box (`#booking`). It is `sticky`, not
`fixed`: it rides along the place's page and stops at its end, so it never covers the site's footer.

#### `/p/[slug]/photos` Photo tour (F2)

Photos grouped by area and room, with a Back button to the place.

**Built so far** (`src/app/(site)/p/[slug]/photos/`, with its `loading.tsx`): under the layout's own back link, the
place's name and "Photo tour", then `PhotoTour` (`src/modules/directory/components/`). `groupPhotos`
(`photo-groups.ts`, a pure function) puts the place's own photos first, under the part of the house they show, in
the order of `PHOTO_AREAS`, with the ones the host never placed last under "Additional photos" (`OTHER`); then each
room that has photos, under its name. A group is never empty and a photo is never in two groups, so the count in
the gallery's link is exactly what the page holds. A place with no photos at all gets the drawn postcard and "No
photos yet."

#### `/p/[slug]/book` Book (F4)

Two columns (`lg:grid-cols-[1fr_400px]`). Start: `GuestDetailsForm` (name, phone, email, number of guests, a note).
End: a `BoardingPass` summary (place, room, dates, nights) with the `PriceBreakdown`.

**New:** the button is "Book and pay" (modes 1 and 2) or "Send request" (mode 3). There is no deposit line: the total
is what is paid.

**Built so far** (`src/app/(site)/p/[slug]/book/`): a signed-out guest is sent to sign in and comes straight back with the
stay in the address (`?room=&checkIn=&checkOut=&guests=`, from the place page); a missing or unreadable stay sends the
guest back to the place page to choose. A stay that cannot be booked (an issue code, or a taken night) shows why and a
"Pick other dates" button instead of the form. `GuestDetailsForm` (name, mobile number, optional email, guests, a note)
checks the fields before sending, in the guest's language, and tidies the number into the international form the booking
needs (`normalizePhone`: "71 123 456" becomes +96171123456); the button spins and stays disabled until the page
leaves, so a double tap never books twice. On success the guest goes to `/b/{token}`. `StaySummary` is the boarding
pass with the stay and the total. The note under the form follows the mode: pay online at once (and, with approval, the
host's answer time), or arrange payment with the host.

#### `/p/[slug]/contact` Contact host (F2a)

1. Title and the host's usual response time.
2. "What guests usually ask": getting there, price and availability (the full price is paid; no deposit), the
   refund rule, house rules.
3. "Still have questions?": `ContactHostForm` and the WhatsApp button, depending on the host's choice.

**Built so far** (`src/app/(site)/p/[slug]/contact/`, with its `loading.tsx`): under the layout's own back link, the
title ("Contact {name}", the host's shown name or the place's) with how quickly they answer under it, and what
guests usually ask as a two-column list: getting there (the area), the full price and no deposit, the refund rule,
and the house rules; each one is left out when the place has nothing to say for it. A link leads back to the
booking box to check dates. Beside it, a `TicketCard` holds `ContactHostForm` (name, the email the host replies to,
and the question, each checked before sending, with the host named in the placeholder; once sent, a thank-you
saying where the answer will arrive, and a way to ask something else) and the WhatsApp button, each shown only if
the host takes questions that way. A host who takes neither gets one calm line instead, pointing the guest to the
dates. A stay carried in the address (`?checkIn=&checkOut=&guests=`, as the place page's links already pass it)
shows on the ticket's stub and goes with the question, so the host answers about the right nights.

#### `/b/[token]` The guest's booking page (F4; the pay buttons F4a)

1. **Title** (`font-poster`) and a numbered step bar (sent, paid, confirmed) with check marks for done steps.
2. **Pay** (online modes, while not paid): "Pay {amount}", the `HoldCountdown` (10 minutes), and `PayOnline`
   (Whish and card buttons).
3. **Waiting for the host** (mode 2 after paying, or mode 3) with the `HoldCountdown` of the host's answer time.
4. **Contact:** the WhatsApp button to the host.
5. **Phone alerts** (`PhoneAlerts`) to follow this booking.
6. `GuestCancelButton` ("Cancel my booking").
7. The `BoardingPass` with the booking details and a `Postmark`.
8. **New: "Near your stay"** (F22): the same `NearbySection` as the place page, for the booking's nights. Not shown
   for a cancelled, declined or expired booking.

**New:** no "Deposit: {amount}" line; the amount is always the full total. A cancelled paid booking says "Refunded
in full".

**Built so far** (`src/app/(site)/b/[token]/`, drawn by `BookingView`): the heading for the booking's status, the step bar
(`bookingProgress`: sent and paid when confirmed at once, sent, paid and confirmed with the host's approval, sent and
confirmed offline; none once the booking ended), then what to do next. While it waits for payment: the amount, the
10-minute `HoldCountdown` and `PayOnline` (Wouroud's, Whish and card). After paying, or offline: the host's answer
time counting down, and offline how to pay the host (their instructions, or a fallback sentence). An ended booking
(declined, expired, cancelled) shows the refund and "Book other dates". Then the host's WhatsApp, `GuestCancelButton`
(asks first; the wording promises a refund only for online payments; hidden from the check-in day on, as the engine
refuses), and the boarding pass with a postmark once confirmed. The countdown starts from the seconds the server says
are left, so a phone with the wrong clock is right. `BookingWatcher` asks the server again every 4 s while paying and
every 15 or 30 s while the host decides, only while the tab is in view, and stops when nothing more can change. Not built
yet: phone alerts (`PhoneAlerts`) and "Near your stay".

#### `/o/[slug]` Experience or service (F8, bonus)

Like the place page: title row, gallery, summary, what is included, `ThingsToKnow`, "Where you meet" map,
`MeetHost`, reviews, and the `SessionBookingCard` (pick a session and seats) on the end side. `ThingsToKnow`'s
"Cancellation" is the same refund rule as the place page (an experience has no "cancel up to N hours" setting).
The card shows the total, which is what is paid: no deposit line.

#### `/assistant` Use Mabeet from your AI app (F6)

**New (decided 2026-11-02):** "Trip Assistant" in the header opens this page. There is no chat on the website: the
assistant is the guest's own AI app, connected through the guest MCP. Texts in the `useWithAi` group. Two columns
from `lg`, like `/host`:

1. **Start side:** `HeroHeading` ("Ask your AI app. Get places that are really free." and one line), then a
   `Section` "What is MCP?" (MCP is a standard way for an AI app to use another service's tools; ours lets your AI
   app search Mabeet's places, check dates and prices), then `IconPoints`: plan the trip in the app you already
   use; real dates and prices, not guesses; the answer links straight to the place's booking page.
2. **End side:** a sticky `TicketCard` "Connect in a minute": no sign-in and no key; as the stub, the guest MCP
   address (`/api/mcp/guest` on our domain, from `BETTER_AUTH_URL`) in a `CopyField`; under the tear line a
   `StepList` for Claude and one for ChatGPT (add a custom connector, paste the address), then an `ExamplePrompt`.
3. **Full width:** a `Section` "What it can and cannot do": a `CheckList` (it searches places, checks dates and
   prices, links to the booking page; it never books or pays, and never sees your account) and a `ButtonLink` to
   `/search`.

No sign-in on this page. Every text in the three message files.

#### `/pricing` Plans (F15, bonus)

1. `PageIntro`: the title and one line.
2. `PlanCards`: Free, Pro, Business with their limits (`CheckList`), the price, a `Pill` on Pro ("Most popular",
   or "Your plan" where `current` is passed) and the button for each. Free goes to `/host`; Pro and Business go to
   `/host?plan=PRO` or `?plan=BUSINESS`.
3. `PageNote`: no commission on any plan.

#### `/about` About Mabeet (F24, approved by Sami)

1. **Opening:** two columns from `lg`. `Eyebrow` "Made in Beirut", `HeroHeading`, "Explore stays" and "Become a host".
   On the end side a `BrandScene`: the `ArchWindow`, a `Receipt` of our promises floating in front (from `sm`; on a
   phone it would cover the text) and a stamped `Postmark`.
2. **The journey:** a `StoryRail` runs through every chapter below: a dashed line on the reading side that fills
   with the accent as the visitor scrolls, with the Mabeet mark (`LogoMark`) travelling along it. Each chapter is a
   `StoryChapter`: its stop on the line fills and pops when the chapter scrolls into view, a "01 · The problem"
   kicker in the glow colour, then the chapter rising in.
   - 01 The problem: a `StatBand` of three `BigStat`s that count up (`CountUp`): up to 18% commission, $14.40 a
     night and $288 a month on an $80 room (the estimate in `scope-lock.md` section 4).
   - 02 How it works: the `Journey` of a booking in four stops, its dashed line drawing itself.
   - 03 Your way: the three booking modes as `TopicCard`s.
   - 04 Our promises: four `TopicCard`s (never double-booked, highlighted; refunds in full; no commission, with "See
     the plans"; your details stay yours, with the privacy link).
   - 05 Your turn: the `LandscapeBand` with "Explore stays" and "Become a host".

#### `/contact` Contact us (F24, approved by Sami)

Two columns from `lg`, like `/host`. Start side: `Eyebrow`, `HeroHeading`, and `TopicCard`s for where each question
is answered best (a booking: the host; listing a place: "Become a host"; your data: the privacy page). End side: a
sticky `TicketCard` "Reach the Mabeet team" with the `ContactForm` (name, email, topic as `ChoiceChips`, message;
then "Message sent" with where the answer will arrive) when `CONTACT_EMAIL` is set, and the `WhatsAppLink` when
`CONTACT_WHATSAPP` is set. With neither, the ticket says the team inbox is not open yet.

#### `/privacy`, `/offline`, not found and error pages (the privacy page: F17)

`/privacy` "Privacy and payments": two columns from `lg` for the opening, `HeroHeading` ("Your details stay yours.")
and a `ReceiptCard` "At a glance" (four promises on a till receipt in a `BrandScene`, with a postmark). Under it,
`OnThisPage` (sticky from `lg`, chips on phones) beside two `Section`s of numbered `TopicCard`s; the refunds card is
highlighted. "Your information": what we keep, who sees it (contact details masked for staff without
`guests.contact`), the calendar links to Airbnb and Booking.com, AI apps, the browser (two cookies: session and
language; no tracking) and downloading or deleting your data. "Paying and refunds" is the payment policy: paying
online through Whish or Stripe, online refunds always full (none once the stay has started), and offline payments
being between the host and the guest.

Not found, the error page and `/offline` are one design, `MessagePage` (`shell/message-page.tsx`): `HeroLandscape`
filling the screen, the wordmark in the corner, a big mark in the accent, the title, one line and the actions.

- Not found (`src/app/not-found.tsx`): the mark is "404"; "Back home".
- A "not found" from a public or dashboard page (a place no longer listed, someone else's booking, a page the member may
  not open) shows inside that frame: `src/app/(site)/not-found.tsx` and `src/app/dashboard/[businessId]/not-found.tsx`
  use `MessagePage framed`, which leaves out its own wordmark and `<main>` (the frame has them). The dashboard's goes
  back to `/dashboard`.
- Error (`error.tsx`): a floating storm cloud; "Try again" and "Back home"; under them the error's reference (its
  digest), to quote when writing to us.
- `/offline`: a floating Wi-Fi-off icon; "Try again" is a plain link that reloads the address. The service worker
  (`public/sw.js`, registered by `ServiceWorker` in the root layout, also in development) saves this page with its
  stylesheets, fonts and logo shapes, so it looks the same with no connection. It answers only when the network
  fails; pages are never cached.

### 8.2 Sign in and accounts (F17)

The `(auth)` layout is the form on one side and the brand panel on the other. From `lg` up it is exactly the window's
height and the page never scrolls: on a short laptop window (the `short:` variant, at least 1024 px wide and at most
800 px tall) the spacing tightens and the back link and the three reasons hide (the wordmark and the brand panel say
the same). Only on a window shorter still does the form's own column scroll.

All use `AuthPage` (a narrow centred card, `max-w-md`) with `AuthForm`:

- `/sign-in`: email, password, "Forgot password?", link to sign up.
- `/sign-up`: name, email, password; then "check your email".
- `/forgot-password` and `/reset-password`: one field each.
- `/home`: no screen; it sends owners to their dashboard and guests to the home page. A confirmation link that has
  expired or was used comes back with `?error=` and goes on to `/sign-in`, which says so (`auth.linkExpired`).
- When Better Auth's rate limit answers (a few tries a minute from one address), every sign-in form says to wait
  (`auth.tooManyAttempts`), never "wrong password", and the forgot-password form does not claim a link was sent.
- `/host` Become a host (inside the site frame, not `AuthPage`): two columns from `lg`. Start side: `HeroHeading`
  (title and intro) and `IconPoints` (four reasons). End side: a sticky `TicketCard` "Create your workspace": the
  intro, a `StepTrail` (Your place, Pay, Add rooms; no Pay on Free), and as the stub a `PlanPicker` (Free, Pro,
  Business as chips; the plan from `/pricing` is chosen, and changing it stays on this page as `?plan=`). Under the
  tear line, `CreateWorkspaceForm` (the place's name and area; with a paid plan, `ChoiceChips` for card or Whish
  when both are on, and "Create and pay"). Signed out, it shows "Create an account to start" and "I already have an
  account", which carry the plan back here.
- `/oauth/consent` and `/oauth/workspace` (F14): "Allow {app} to connect?" and "Which workspace?" when Claude or
  ChatGPT connects.

### 8.3 Guest account (F4; notifications F14a; favourites and reviews F5)

Tabs at the top (`AccountTabs`):

- `/account`: your trips (upcoming and past), and a review form after check-out (one overall star rating and a
  comment; no separate cleanliness, location or value ratings).
- `/account/favorites`: a `PlaceGrid` of saved places.
- `/account/activity`: what you did, newest first.
- `/account/notifications`: notifications on this device (`PhoneAlerts`).
- `/account/privacy`: download or delete your data (`PrivacyControls`).

**Built so far** (`/account`, `src/app/(site)/account/`): the greeting with Sign out, then the guest's trips in two lists,
**Upcoming** (alive and not over, soonest first: what waits for payment or the host stands out) and **Past stays**
(over, declined, expired or cancelled, newest first; a stay is over on its check-out day). Each trip is a card that
links to its booking page, with the place, the room, the dates, the guests, the price and a status label in the guest's
words; a long place name gives way to the label. With no trips: "No trips yet. Where to first?" and a button to explore.
A signed-out visitor signs in and comes back. Every account page starts with `AccountHeader` (`accounts` module: the
greeting, Sign out and `AccountTabs`, which lists only the pages built: Trips, Notifications and Privacy).
`/account/notifications` is `PhoneAlerts` (`notifications` module): turn push on or off for this device, or why it
cannot be (blocked in the browser, not supported, or on iPhone not yet on the Home Screen); when the server has no
push keys it says updates still come by email. `/account/privacy` is
`PrivacyControls`: "Download my data" (`GET /api/me/export`, a JSON file) and "Delete my account", behind a
confirmation where the guest types their email (`POST /api/me/delete`), then signed out to the home page; an only owner
of a place is told to add another owner first. Favourites, activity and the review form are not built yet.

### 8.4 Host dashboard (`AppShell`, every page starts with `PageHeader`)

**Built so far** (Today and All my places): `/dashboard/[id]` is the place's home (menu entry `overview`, open to
members who read bookings or the numbers): the four `StatTile`s over the last 90 days, the savings panel per currency
(direct bookings, commission saved, plan fees in that currency, kept), up to 20 requests waiting as `BookingRow`s, then
`BarChart` of nights by month and `ShareBar` of channels (`channelColor` in `analytics`). Each part shows only to a
role that reads it. `/dashboard` is "All my places" in its own `AppShell` (the person's places as the menu): today's
totals, then a card per place, numbers only where their role reads bookings; one place goes straight to it, none to
`/host`. `StatTile`, `BarChart` and `ShareBar` are shared in `components/ui`. `/dashboard/[id]/analytics` (menu, Money, `analytics.read`):
the filters as a plain form (30, 90 or 365 days, any period, this place or all), eight numbers, nights and revenue
by month, channels and requests by outcome (`ShareBar`), and a row per place when there are several. No rating until
reviews are built; the AI report is a later bonus.

| Page                       | Feature     | Sections, top to bottom                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard` All my places | F12         | `PageHeader` "All my places"; one card per place: arrivals today, requests waiting, money                                                                                                                                                                                                                                                                                                          |
| `/dashboard/[id]` Today    | F12         | 4 `StatTile`s (occupancy, direct revenue, commission saved, nights sold); the savings panel (revenue, commission saved, plan fees, kept); requests waiting (`BookingRow`s, waiting first); nights by month (`BarChart`) and channels (`ShareBar`) side by side                                                                                                                                     |
| `/analytics`               | F12         | Filters (period, one place or all); `StatTile`s; nights, revenue, channels and requests charts; a per-place table; the AI report (`ReportGenerator`, W)                                                                                                                                                                                                                                            |
| `/bookings`                | F9          | Stays and experience sessions, waiting ones first. Each `BookingRow` shows the guest, room, dates, total, status and countdown, with `BookingActions` on the row: Confirm and Decline (modes 2 and 3), Cancel (every mode), each with `useConfirm`. There is no separate booking page.                                                                                                             |
| `/calendar`                | F10         | `CalendarBoard`: month, week and rooms views; the side panel for the chosen day; `CloseDatesForm`. A platform booking that clashes with ours has a red outline and a note in the side panel; it is never cancelled from here                                                                                                                                                                       |
| `/channels`                | F10         | Each room's export link (`CopyField`); connected Airbnb, Booking.com or other links with last sync and error (`FeedButtons`: Sync now, Remove); `AddFeedForm`                                                                                                                                                                                                                                      |
| `/place` Your place        | F7, F3      | `PlaceEssentials` (description, whole place or by room), the whole-place unit with its `SpecialPrices`, `PhotoManager` (photos by area), and `SettingsForm` (place part: name, area, region, address, categories, tags, accessibility, location, check-in times and house rules)                                                                                                                   |
| `/rooms`                   | F7          | Each room in a `RoomEditor` with `PhotoManager` and `SpecialPrices`; "Add a room"                                                                                                                                                                                                                                                                                                                  |
| `/offerings`               | F8 (bonus)  | `OfferingEditor`, `PhotoManager`, `SessionScheduler`. No cancellation-hours field                                                                                                                                                                                                                                                                                                                  |
| `/reviews`                 | F5 (bonus)  | Average rating; each review with `ReviewControls` (reply, hide with a reason)                                                                                                                                                                                                                                                                                                                      |
| `/payouts`                 | F12a        | `StatTile`s (available, upcoming, paid out); `PayoutRequestForm`; payout history; online payments                                                                                                                                                                                                                                                                                                  |
| `/billing`                 | F15 (bonus) | Current plan, `PlanCards`, `UpgradeButton`, `WhishPlanButton`                                                                                                                                                                                                                                                                                                                                      |
| `/team`                    | F13         | Members (`MemberControls`: role and Remove, both confirmed; "you" on your own row), the invitation form (`AddMemberForm`, the owner role last), the invitations sent (status, `CancelInvitation`), then the roles as `DisclosurePanel`s (`RoleEditor`; the owner role only described) and "New role". Members and invitations need `team.manage`, the roles `roles.manage`                         |
| `/assistant`               | F14 (bonus) | `TeamAssistant`: New chat, History, Temporary chat; the chat; `ActionCard`s under replies                                                                                                                                                                                                                                                                                                          |
| `/keys`                    | F14 (bonus) | `KeyManager` (create, list, revoke keys; how to connect Claude, Cursor or Codex; the apps connected by signing in, with the server address and Disconnect) and the audit list                                                                                                                                                                                                                      |
| `/settings`                | F9a         | `SettingsForm`: contact, currency, commission rate, owner's answer time, listed or not, and how guests pay you directly (`paymentInstructions`, for offline mode). No cancellation policy field: the refund rule is the only one. House rules and check-in times are on `/place`. **New:** the booking mode (3 choices as large radio cards) and accepting the payment policy for the online modes |
| `/profile`                 | F2a         | `ProfileForm`, `HostProfileForm` (bio, city, languages, how guests reach you, show or hide; no phone or WhatsApp: guests use the business's numbers), `PasswordForm`                                                                                                                                                                                                                               |
| `/notifications`           | F14a        | `PhoneAlerts`, `NotificationList`, `Pagination`. Includes calendar clashes (new and cleared), linking to `/calendar`                                                                                                                                                                                                                                                                               |

### 8.5 Platform admin (`AppShell` in admin mode) (F16, bonus; the money page F16a)

| Page                                       | Sections                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                   | Overview `StatTile`s (businesses, users, bookings in 30 days, earned this month); "Needs attention"; newest businesses                                                                |
| `/admin/hosts` and `/admin/hosts/[userId]` | All hosts; one host's profile and their businesses with `BusinessStatusToggle` and "Open"                                                                                             |
| `/admin/users`                             | All users                                                                                                                                                                             |
| `/admin/categories`                        | `CategoryManager`                                                                                                                                                                     |
| `/admin/partners` (F23)                    | Partner places (`PartnerEditor`: name, kind, region, map pin, photo, link, phone; remove and bring back), and sponsored dates for a partner or a platform experience or service       |
| `/admin/appearance`                        | `SitePalettePicker`: the 5 palettes, light and dark preview                                                                                                                           |
| `/admin/health`                            | Calendar sync health and AI spending                                                                                                                                                  |
| `/admin/money` (F16a)                      | Earned from plans (all, this month, card, Whish), revenue by month, payouts to send (`PayoutDecision`), what is owed to hosts, refunds to send by hand (`RefundSent`), recent payouts |
| `/admin/notifications`, `/admin/profile`   | Same as the dashboard's                                                                                                                                                               |

### 8.6 Whish simulator (F4a)

`/whish-simulator/pay/[code]`: the page our Whish simulator shows instead of Whish's: the amount, what it is for,
the sandbox phone and code, and "Confirm payment" or "Cancel and go back" (`WhishSimulatorForm`). It is its own page,
outside Mabeet's header and footer, dressed as Whish's: their red band and wordmark, light grey, a white card, Source
Sans (`data-provider="whish"` in `globals.css` gives the same token names Whish's values, always light). The
"Test mode" badge and banner always stay, so it is never taken for the real Whish. Only in `WHISH_MODE=simulator`;
otherwise it answers 404.

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
