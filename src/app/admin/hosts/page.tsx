import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { BusinessStatusToggle } from "@/modules/workspaces";
import { listPlatformBusinesses } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

type Business = Awaited<ReturnType<typeof listPlatformBusinesses>>["businesses"][number];
type Owner = Business["owners"][number];

/** Each owner once, with every business they own, the newest host first. */
function byHost(businesses: Business[]) {
  const hosts = new Map<string, { owner: Owner; businesses: Business[] }>();
  for (const business of businesses) {
    for (const owner of business.owners) {
      const host = hosts.get(owner.id) ?? { owner, businesses: [] };
      host.businesses.push(business);
      hosts.set(owner.id, host);
    }
  }
  return [...hosts.values()];
}

/**
 * Every host with all their businesses: each business's size, its status, and suspending or reactivating it. "Open"
 * takes the admin into its dashboard, where the top bar says they are visiting.
 */
export default async function AdminHostsPage() {
  const actor = await requirePageAdmin();
  const [t, locale, { businesses }] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    listPlatformBusinesses(actor),
  ]);
  const hosts = byHost(businesses);

  return (
    <>
      <PageHeader title={t("hosts.title")} intro={t("hosts.intro", { count: hosts.length })} />
      {hosts.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("businessesIntro")}</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          {hosts.map(({ owner, businesses: owned }) => (
            <Panel
              key={owner.id}
              title={owner.name}
              intro={t("hosts.theirBusinesses", { count: owned.length })}
              action={
                <Link
                  href={`/admin/hosts/${owner.id}`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  {t("hosts.profile")}
                </Link>
              }
            >
              <p className="mb-3 text-sm text-muted">
                <bdi dir="ltr">{owner.email}</bdi>
                {owner.phone && (
                  <>
                    {" · "}
                    <bdi dir="ltr">{owner.phone}</bdi>
                  </>
                )}
              </p>
              <ul className="divide-y divide-line">
                {owned.map((business) => (
                  <li key={business.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <bdi>{business.name}</bdi>
                        {business.status === "SUSPENDED" && <Pill>{t("hosts.suspended", { count: 1 })}</Pill>}
                      </p>
                      <p className="text-sm text-muted">
                        {business.area && (
                          <>
                            <bdi>{business.area}</bdi>
                            {" · "}
                          </>
                        )}
                        {t("rooms")} {business.roomCount} · {t("bookings")} {business.bookingCount} ·{" "}
                        {t("since")} {formatDate(toIsoDate(business.createdAt), locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <ButtonLink href={`/dashboard/${business.id}`} size="sm" variant="secondary">
                        {t("hosts.openDashboard")}
                      </ButtonLink>
                      <BusinessStatusToggle
                        businessId={business.id}
                        businessName={business.name}
                        suspended={business.status === "SUSPENDED"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
