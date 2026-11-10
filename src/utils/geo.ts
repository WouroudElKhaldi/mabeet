// Distances between map pins, for "nearest first" lists. Pure, so the screens and the server agree.

export type MapPin = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** How far apart two pins are, in kilometres, as the crow flies (the haversine formula). */
export function distanceKm(from: MapPin, to: MapPin): number {
  const latitudeStep = radians(to.latitude - from.latitude);
  const longitudeStep = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeStep / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeStep / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A pin when both halves are known, otherwise none: a place or partner may have no map pin yet. */
export function mapPin(latitude: number | null, longitude: number | null): MapPin | null {
  return latitude === null || longitude === null ? null : { latitude, longitude };
}
