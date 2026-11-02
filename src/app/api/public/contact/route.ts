import { contactMessage } from "@/modules/contact";
import { sendContactMessage } from "@/modules/contact/server";
import { requestLocale } from "@/server/http/error-i18n";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, route } from "@/server/http/route";

/** A message to the Mabeet team from the Contact page. No sign-in; a few messages an hour from one address. */
export const POST = route(async (request) => {
  await enforceRateLimit(`contact:${clientAddress(request)}`, 5, 60 * 60_000);
  const input = await parseBody(request, contactMessage);
  sendContactMessage(input, requestLocale(request));
  return json({ sent: true }, 202);
});
