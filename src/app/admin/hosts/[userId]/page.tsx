import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { isLanguage } from "@/config/listing";
import { BusinessStatusToggle } from "@/modules/workspaces";
import { getPlatformHost } from "@/modules/workspaces/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

type PageProps = { params: Promise<{ userId: string }> };

/** One host: their contacts and host profile, and each of their businesses to open, view or suspend. */
export default async function AdminHostPage({ params }: PageProps) {
  const { userId } = await params;
  const actor = await requirePageAdmin();
  const [t, tAdmin, languageNames, locale, host] = await Promise.all([
    getTranslations("admin.hosts"),
    getTranslations("admin"),
    getTranslations("listing.languages"),
    getLocale(),
    getPlatformHost(actor, userId),
  ]);
  const day = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "long", year: "numeric" });
  const profile = host.profile;
  const languages = (profile?.languages ?? []).filter(isLanguage);

  return (
    <>
      <PageHeader
        title={profile?.displayName ?? host.name}
        intro={t("theirBusinesses", { count: host.businesses.length })}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Panel
          title={t("profile")}
          action={
            profile ? (
              <Pill tone={profile.showOnListings ? "accent" : "quiet"}>
                {profile.showOnListings ? t("shown") : t("hidden")}
              </Pill>
            ) : undefined
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("email")}</dt>
              <dd className="font-semibold">
                <bdi dir="ltr">{host.email}</bdi>
              </dd>
            </div>
            {host.phone && (
              <div>
                <dt className="text-muted">{t("phone")}</dt>
                <dd className="font-semibold">
                  <bdi dir="ltr">{host.phone}</bdi>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted">{t("joined")}</dt>
              <dd className="font-semibold">{day(host.createdAt)}</dd>
            </div>
            {profile?.city && (
              <div>
                <dt className="text-muted">{t("city")}</dt>
                <dd className="font-semibold">
                  <bdi>{profile.city}</bdi>
                </dd>
              </div>
            )}
            {languages.length > 0 && (
              <div>
                <dt className="text-muted">{t("languages")}</dt>
                <dd className="font-semibold">{languages.map((code) => languageNames(code)).join(", ")}</dd>
              </div>
            )}
            {profile?.hostingSince && (
              <div>
                <dt className="text-muted">{t("hostingSince")}</dt>
                <dd className="font-semibold">{profile.hostingSince}</dd>
              </div>
            )}
          </dl>
          {profile?.bio ? (
            <p className="mt-4 text-sm whitespace-pre-line">
              <bdi>{profile.bio}</bdi>
            </p>
          ) : (
            !profile && <p className="mt-4 text-sm text-muted">{t("noProfile")}</p>
          )}
        </Panel>

        <Panel title={t("businesses")}>
          <ul className="divide-y divide-line">
            {host.businesses.map((business) => (
              <li key={business.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <bdi>{business.name}</bdi>
                    {business.status === "SUSPENDED" && <Pill>{t("suspended", { count: 1 })}</Pill>}
                  </p>
                  <p className="text-sm text-muted">
                    {t("counts", {
                      rooms: business.roomCount,
                      offerings: business.offeringCount,
                      bookings: business.bookingCount,
                      team: business.teamCount,
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {business.area && (
                      <>
                        <bdi>{business.area}</bdi>
                        {" · "}
                      </>
                    )}
                    {tAdmin("since")} {day(business.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <ButtonLink href={`/dashboard/${business.id}`} size="sm" variant="secondary">
                    {t("openDashboard")}
                  </ButtonLink>
                  {business.status === "ACTIVE" && (
                    <ButtonLink href={`/p/${business.slug}`} size="sm" variant="ghost">
                      {t("openPage")}
                    </ButtonLink>
                  )}
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
      </div>
    </>
  );
}
