import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { ButtonLink } from "@/components/ui/button";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { Pill } from "@/components/ui/pill";
import { getPlatformPerson } from "@/modules/accounts/server";
import { listPersonTripsForAdmin } from "@/modules/bookings/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate, formatMoney, formatStayDates } from "@/utils/format";

type PageProps = { params: Promise<{ userId: string }> };

/** One person for the admin: their account, the places they work in and their role there, and their latest stays. */
export default async function AdminPersonPage({ params }: PageProps) {
  const { userId } = await params;
  const actor = await requirePageAdmin();
  const [t, tStatus, tPlans, locale, person, trips] = await Promise.all([
    getTranslations("admin.people"),
    getTranslations("account.status"),
    getTranslations("plans.names"),
    getLocale(),
    getPlatformPerson(actor, userId),
    listPersonTripsForAdmin(actor, userId),
  ]);
  const day = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "long", year: "numeric" });
  const ownsPlace = person.places.some((place) => place.isOwner);
  const facts = [
    { label: t("email"), value: <bdi dir="ltr">{person.email}</bdi> },
    { label: t("phone"), value: person.phone ? <bdi dir="ltr">{person.phone}</bdi> : "—" },
    { label: t("joined"), value: day(person.createdAt) },
    { label: t("emailVerified"), value: person.emailVerified ? t("yes") : t("no") },
    { label: t("trips"), value: person.tripCount },
    { label: t("reviews"), value: person.reviewCount },
  ];

  return (
    <>
      <PageHeader
        title={person.name}
        intro={person.platformRole === "SUPER_ADMIN" ? t("kinds.admin") : undefined}
        actions={
          ownsPlace ? (
            <ButtonLink href={`/admin/hosts/${person.id}`} size="sm" variant="secondary">
              {t("hostPage")}
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Panel title={t("account")}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-muted">{fact.label}</dt>
                <dd className="font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title={t("placesTitle")}>
          {person.places.length === 0 ? (
            <p className="text-sm text-muted">{t("noPlaces")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {person.places.map((place) => (
                <li key={place.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <bdi>{place.name}</bdi>
                      <Pill tone={place.isOwner ? "accent" : "quiet"}>{place.roleName}</Pill>
                    </p>
                    <p className="text-sm text-muted">
                      {tPlans(place.plan)} · {t("since", { date: day(place.joinedAt) })}
                    </p>
                  </div>
                  <ArrowLink href={`/dashboard/${place.id}`}>{t("openDashboard")}</ArrowLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <section aria-labelledby="person-trips">
          <h2 id="person-trips" className="mb-3 text-xl font-semibold">
            {t("tripsTitle")}
          </h2>
          {trips.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("noTrips")}</p>
          ) : (
            <DataTable
              label={t("tripsTitle")}
              columns={[
                { label: t("place") },
                { label: t("dates") },
                { label: t("status"), wide: true },
                { label: t("total"), align: "end", wide: true },
              ]}
            >
              {trips.map((trip) => (
                <DataRow key={trip.id}>
                  <DataCell>
                    <p className="font-semibold">
                      <bdi>{trip.placeName}</bdi>
                    </p>
                    <p className="text-muted">
                      <bdi>{trip.roomName}</bdi> · <bdi dir="ltr">{trip.reference}</bdi>
                    </p>
                  </DataCell>
                  <DataCell className="whitespace-nowrap">
                    {formatStayDates(trip.checkIn, trip.checkOut, locale)}
                  </DataCell>
                  <DataCell wide>{tStatus(trip.status)}</DataCell>
                  <DataCell align="end" wide className="tabular-nums">
                    {formatMoney(trip.totalCents, trip.currency, locale)}
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </>
  );
}
