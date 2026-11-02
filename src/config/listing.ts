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
