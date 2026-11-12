import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ArchivePlaceButton, SettingsForm } from "@/modules/workspaces";
import { getSettings } from "@/modules/workspaces/server";
import { isBusinessOwner } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * How the business runs: how guests reach it, whether it is listed, how guests book and pay (the owner's choice), the
 * currency, the time to answer a request and the commission direct bookings save. At the end, for the place's own
 * owners, archiving it: closed to guests, kept for the team.
 */
export default async function SettingsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.settings.anyOf);
  const [t, settings] = await Promise.all([getTranslations("dashboard.settings"), getSettings(ctx)]);

  return (
    <>
      <PageHeader title={t("title")} intro={t("generalIntro")} />
      <SettingsForm businessId={businessId} part="general" settings={settings} isOwner={ctx.isOwner} />
      {isBusinessOwner(ctx) ? (
        <div className="mt-8">
          <Panel
            title={t("archive.title")}
            intro={settings.status === "ARCHIVED" ? t("archive.archivedIntro") : t("archive.intro")}
          >
            <ArchivePlaceButton businessId={businessId} archived={settings.status === "ARCHIVED"} />
          </Panel>
        </div>
      ) : null}
    </>
  );
}
