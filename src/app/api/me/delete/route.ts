import { accountDeletion } from "@/modules/accounts";
import { deleteMyAccount } from "@/modules/accounts/server";
import { json, parseBody, requireUser, route } from "@/server/http/route";

/** Deletes the signed-in person's account. The body repeats their email as confirmation. */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { email } = await parseBody(request, accountDeletion);
  await deleteMyAccount(user, email);
  return json({ ok: true });
});
