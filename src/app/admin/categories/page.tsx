import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { CategoryManager } from "@/modules/admin";
import { listCategoriesForAdmin } from "@/modules/admin/server";
import { requirePageAdmin } from "@/server/http/session";

/** The categories guests browse by, for places, experiences and services. */
export default async function AdminCategoriesPage() {
  const actor = await requirePageAdmin();
  const [t, categories] = await Promise.all([
    getTranslations("admin.categories"),
    listCategoriesForAdmin(actor),
  ]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} />
      <CategoryManager
        categories={categories.map(({ _count, ...category }) => ({
          ...category,
          uses: _count.businesses + _count.offerings,
        }))}
      />
    </>
  );
}
