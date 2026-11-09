import type { Locale } from "@/config/appearance";
import { getHostSection, getPublicPlace } from "@/modules/workspaces/server";
import { forbidden, notFound } from "@/server/errors";
import { secureToken } from "@/utils/tokens";
import { acceptsMessages } from "../host";
import type { HostMessage } from "../schemas";
import { notifyHostMessage } from "./directory-notifications";

// Questions to a place's host from its Contact host page. Nothing is stored: the question is emailed to the people
// who can decide the place's bookings, and they reply straight to the guest.

/**
 * Sends a guest's question to the place's hosts. Refused when the host takes questions on WhatsApp only. The email
 * is a job: a mail outage does not fail the guest's request, and the worker retries it.
 */
export async function sendHostMessage(slug: string, input: HostMessage, locale: Locale): Promise<void> {
  const place = await getPublicPlace(slug);
  if (!place) throw notFound("Place");
  const host = await getHostSection(place.id);
  if (!acceptsMessages(host.contactBy)) throw forbidden("This host answers on WhatsApp only");
  notifyHostMessage({
    businessId: place.id,
    placeName: place.name,
    ...input,
    locale,
    reference: secureToken(),
  });
}
