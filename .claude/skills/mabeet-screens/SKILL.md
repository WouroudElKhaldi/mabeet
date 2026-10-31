---
name: mabeet-screens
description: Build or change a Mabeet page, screen or component - the fixed design system (tokens, five palettes, light and dark), shared components, the four states of every screen, phones first, English and Arabic right-to-left. Use before touching any page under src/app or anything in src/components.
---

# Mabeet screens

1. Open `docs/team/08-design-system-and-pages.md`. Read Part 1 (the rules), the colours, fonts and spacing you use,
   Part 6 (the shared components), Part 7 (the four states: loading, empty, error, filled), and the page's own entry
   in Part 8. Build its sections in that order, with the containers, text sizes and components it names.
2. The design is fixed: tokens only (`bg-surface`, `text-muted`, `bg-accent text-accent-ink`...), never hex colours
   or Tailwind's default colours, never a new font, spacing or component style. Reuse `src/components/ui/`.
3. Server components by default; `"use client"` only for state, effects or click handlers. In the browser, call the
   API with `api` from `src/lib/api-client.ts` and show errors with `FormError`.
4. Every text goes in `messages/en.json`, `ar.json` and `ar-LB.json` with the same key.
5. Check it at 390 pixels wide, with no sideways scrolling, in English and Arabic, light and dark, and with a Back
   button to the page it belongs to.
6. Finish with the checklist in Part 9 of `08-design-system-and-pages.md`.
