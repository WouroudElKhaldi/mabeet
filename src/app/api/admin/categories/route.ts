import { z } from "zod";
import { categoryInput } from "@/modules/admin";
import { createCategory, listCategoriesForAdmin } from "@/modules/admin/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** Every browse category, with how many places and experiences use it. Platform admins only. */
export const GET = adminRoute(z.object({}), async ({ actor }) => json(await listCategoriesForAdmin(actor)));

/** Adds a browse category, or brings back a deleted one with the same slug. */
export const POST = adminRoute(z.object({}), async ({ request, actor }) => {
  await createCategory(actor, await parseBody(request, categoryInput));
  return json({ ok: true }, 201);
});
