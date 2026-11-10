// The only door into this module for server code (routes, pages, other modules). Anything not exported here is
// private to the module.
import { cache } from "react";
import { getPlace } from "./server/directory-service";

export { sendHostMessage } from "./server/contact-host-service";
export { isPlaceSaved, listMyFavorites, setFavorite } from "./server/favorite-service";

export {
  checkPlaceAvailability,
  getPlace,
  getRoomAvailability,
  listMyTrips,
  quoteRoom,
  searchPlaces,
} from "./server/directory-service";

/** `getPlace`, read once however many times one request asks (a page and its title both do). */
export const loadPlace = cache(getPlace);
