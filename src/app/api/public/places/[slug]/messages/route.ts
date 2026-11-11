import { placeParams } from "@/modules/bookings";
import { hostMessage } from "@/modules/directory";
import { sendHostMessage } from "@/modules/directory/server";
import { requestLocale } from "@/server/http/error-i18n";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";

/**
 * A guest's question to a place's host, from its Contact host page. No sign-in (many guests ask before they have an
 * account); a few questions an hour from one address, across all places, so nobody can flood the hosts' inboxes.
 */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`host-message:${clientAddress(request)}`, 5, 60 * 60_000);
  const { slug } = await parseParams(context, placeParams);
  const input = await parseBody(request, hostMessage);
  await sendHostMessage(slug, input, requestLocale(request));
  return json({ sent: true }, 202);
});
