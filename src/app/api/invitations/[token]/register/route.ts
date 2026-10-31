import { invitationRegister, invitationToken } from "@/modules/team";
import { registerFromInvitation } from "@/modules/team/server";
import { requestLocale } from "@/server/http/error-i18n";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";
import { json, parseBody, parseParams, route } from "@/server/http/route";

/**
 * Someone without an account registers from their invitation and joins the team. The email is the invited one,
 * already proved by the link. The browser signs in with the new password afterwards.
 */
export const POST = route(async (request, context) => {
  await enforceRateLimit(`invitation:${clientAddress(request)}`, 10, 60 * 60_000);
  const { token } = await parseParams(context, invitationToken);
  const input = await parseBody(request, invitationRegister);
  return json(await registerFromInvitation(token, input, requestLocale(request)), 201);
});
