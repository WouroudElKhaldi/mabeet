import { exportMyData } from "@/modules/accounts/server";
import { requireUser, route } from "@/server/http/route";

/** Downloads everything held about the signed-in person as a JSON file. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const data = await exportMyData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mabeet-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
