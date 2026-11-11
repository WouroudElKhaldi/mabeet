import { z } from "zod";
import { FEED_SOURCES } from "@/config/enums";
import { id, workspaceParams } from "@/lib/schemas";

// The input checks of calendar links, shared by the routes and the screens.

export const feedParams = workspaceParams.extend({ feedId: id });

/** Connecting a room to an Airbnb, Booking.com or other calendar link. The server checks it is public https. */
export const feedInput = z.object({
  roomId: id,
  url: z.url().max(2000),
  source: z.enum(FEED_SOURCES),
});

/** A room's own calendar link, as Airbnb and Booking.com call it. */
export const exportTokenParams = z.object({
  // Some platforms only take an address that ends in .ics; both forms reach the same room.
  token: z
    .string()
    .max(70)
    .transform((token) => token.replace(/\.ics$/, ""))
    .pipe(z.string().min(20).max(64)),
});
