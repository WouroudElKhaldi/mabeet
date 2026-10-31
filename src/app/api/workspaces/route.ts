import { listWorkspaces } from "@/modules/team/server";
import { workspaceInput } from "@/modules/workspaces";
import { createWorkspace } from "@/modules/workspaces/server";
import { json, parseBody, requireUser, route } from "@/server/http/route";

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json(await listWorkspaces(user.id));
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = await parseBody(request, workspaceInput);
  return json(await createWorkspace(user.id, input), 201);
});
