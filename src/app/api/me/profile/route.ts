import { profileInput } from "@/modules/accounts";
import { updateMyProfile } from "@/modules/accounts/server";
import { json, parseBody, requireUser, route } from "@/server/http/route";

/** The signed-in person changes their own name and phone. */
export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  return json(await updateMyProfile(user.id, await parseBody(request, profileInput)));
});
