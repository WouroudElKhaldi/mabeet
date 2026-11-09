// Fixed vocabularies for listings. Stored as keys; labels live in messages/*.json, so search filters stay clean.

/** Tags owners pick for a place, and guests filter by. */
export const TAGS = [
  "family-friendly",
  "romantic",
  "pet-friendly",
  "work-friendly",
  "group-friendly",
  "hiking-nearby",
  "sea-view",
  "mountain-view",
  "historic",
  "eco-friendly",
  "quiet",
  "local-food",
] as const;

/** Accessibility features, shown under "Things to know" and usable as a filter. */
export const ACCESSIBILITY = [
  "step-free-access",
  "step-free-bathroom",
  "disabled-parking",
  "flat-ground",
  "wide-doorways",
  "low-sensory",
] as const;

/**
 * Languages a host says they speak, on their profile and on their places' pages. Keys, like every list here; the
 * names are in `listing.languages` in the message files.
 */
const LANGUAGES = ["ar", "en", "fr"] as const;

export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (value: string): value is Language =>
  (LANGUAGES as readonly string[]).includes(value);
