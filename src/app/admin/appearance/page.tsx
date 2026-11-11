import { getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { SitePalettePicker } from "@/modules/admin";
import { getSitePalette } from "@/modules/admin/server";
import { requirePageAdmin } from "@/server/http/session";

/** The website's colour palette, the same for every visitor. */
export default async function AdminAppearancePage() {
  await requirePageAdmin();
  const [t, tNav, palette] = await Promise.all([
    getTranslations("admin.theme"),
    getTranslations("admin.nav"),
    getSitePalette(),
  ]);
  return (
    <>
      <PageHeader title={tNav("appearance")} intro={t("hint")} />
      <Panel title={t("title")}>
        <SitePalettePicker current={palette} />
      </Panel>
    </>
  );
}
