import { categoryParams, categoryUpdate } from "@/modules/admin";
import { deleteCategory, updateCategory } from "@/modules/admin/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** Renames, re-icons or reorders a category. Its slug and kind stay. */
export const PATCH = adminRoute(categoryParams, async ({ request, actor, params: { slug } }) => {
  await updateCategory(actor, slug, await parseBody(request, categoryUpdate));
  return json({ ok: true });
});

/** Deletes a category no place or experience uses. */
export const DELETE = adminRoute(categoryParams, async ({ actor, params: { slug } }) => {
  await deleteCategory(actor, slug);
  return json({ ok: true });
});
