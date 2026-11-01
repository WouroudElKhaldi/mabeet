// The database keeps a room's amenities as plain text (Room.amenities), so this list is what decides which ones
// are allowed.

/** What a room offers, in the order the screens list them. */
export const AMENITIES = [
  "wifi",
  "parking",
  "breakfast",
  "ac",
  "heating",
  "fireplace",
  "jacuzzi",
  "pool",
  "kitchen",
  "view",
  "garden",
  "pets",
  "generator",
] as const;
