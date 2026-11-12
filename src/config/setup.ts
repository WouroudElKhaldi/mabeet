// Getting a new place ready for guests: the steps of its checklist, in order. The checklist works each one out from
// what is saved (src/modules/rooms/server/setup-service.ts), and the screens name them (`setup.steps.*`). The guided
// setup asks the same things one question a screen (`/dashboard/{id}/setup?step=`).

export const SETUP_STEPS = ["describe", "photos", "rooms", "booking", "contact", "publish"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** A place's page shows its photos as one large and four small, so five fill it without gaps. */
export const SETUP_PHOTOS = 5;

/** The guided setup's screens, in order: one question each, the last one the checklist with "Publish". */
export const SETUP_SCREENS = [
  "unit",
  "profile",
  "describe",
  "photos",
  "rooms",
  "booking",
  "contact",
  "publish",
] as const;
export type SetupScreen = (typeof SETUP_SCREENS)[number];

/**
 * The screen each checklist step leads to. Describing the place needs its town too, which is asked on the profile
 * screen just before the description.
 */
export const SETUP_SCREEN_OF_STEP = {
  describe: "profile",
  photos: "photos",
  rooms: "rooms",
  booking: "booking",
  contact: "contact",
  publish: "publish",
} as const satisfies Record<SetupStep, SetupScreen>;
