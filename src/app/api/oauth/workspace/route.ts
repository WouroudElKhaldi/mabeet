import { workspaceChoice } from "@/modules/assistant";
import { chooseWorkspace } from "@/modules/assistant/server";
import { json, parseBody, requireSession, route } from "@/server/http/route";

/** Keeps the place picked on /oauth/workspace on the current sign-in session, while an AI app connects. */
export const POST = route(async (request) => {
  const { session } = await requireSession(request);
  const { businessId } = await parseBody(request, workspaceChoice);
  await chooseWorkspace({ id: session.id, userId: session.userId }, businessId);
  return json({ ok: true });
});
