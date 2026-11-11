// Getting a new place ready for guests: the steps of its checklist, in order. The checklist works each one out from
// what is saved (src/modules/rooms/server/setup-service.ts), and the screens name them (`setup.steps.*`).

export const SETUP_STEPS = ["describe", "photos", "rooms", "booking", "contact", "publish"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** A place's page shows its photos as one large and four small, so five fill it without gaps. */
export const SETUP_PHOTOS = 5;
