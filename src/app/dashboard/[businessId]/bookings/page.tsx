import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { ChoiceLinks } from "@/components/ui/choice-links";
import { BookingRow } from "@/modules/bookings";
import { listBookings, listSessionBookings } from "@/modules/bookings/server";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { todayUtc } from "@/utils/dates";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = ["requests", "upcoming", "past", "all"] as const;
type Tab = (typeof TABS)[number];

/** The longest list one tab shows. */
const PAGE_SIZE = 100;

/** Which stays each tab lists: requests waiting for the host, stays still to end, stays already begun, everything. */
function filtersFor(tab: Tab, today: Date) {
  if (tab === "requests") return { status: "HELD" as const };
  if (tab === "upcoming") return { from: today };
  if (tab === "past") return { to: today };
  return {};
}

/** The same tabs for seats: requests waiting for the host, sessions still to start, sessions already begun. */
function seatFiltersFor(tab: Tab, now: Date) {
  if (tab === "requests") return { status: "HELD" as const };
  if (tab === "upcoming") return { startsFrom: now };
  if (tab === "past") return { startsBefore: now };
  return {};
}

/**
 * The host's stays and, under them, the seats booked in their experiences and services, by tab, with Confirm,
 * Decline and Cancel on each row for members who may decide. A place that sells no sessions sees only its stays.
 */
export default async function BookingsPage({ params, searchParams }: PageProps) {
  const [{ businessId }, { tab: asked }] = await Promise.all([params, searchParams]);
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.bookings.anyOf);
  const tab = TABS.find((name) => name === asked) ?? "requests";
  const now = new Date();
  const [t, bookings, seats, place] = await Promise.all([
    getTranslations("dashboard.bookings"),
    listBookings(ctx, { ...filtersFor(tab, todayUtc(now)), take: PAGE_SIZE, skip: 0 }),
    listSessionBookings(ctx, { ...seatFiltersFor(tab, now), take: PAGE_SIZE, skip: 0 }),
    getPlaceBasics(ctx),
  ]);
  const canDecide = can(ctx, "bookings.decide");

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <ChoiceLinks
        label={t("tabsLabel")}
        choices={TABS.map((name) => ({
          href: `?tab=${name}`,
          label: t(`tabs.${name}`),
          current: name === tab,
        }))}
      />
      {seats.length > 0 ? <h2 className="mt-8 text-lg font-semibold">{t("staysTitle")}</h2> : null}
      {bookings.length === 0 ? (
        <p className="mt-6 text-muted">{t(`emptyTabs.${tab}`)}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              businessId={businessId}
              canDecide={canDecide}
              now={now}
            />
          ))}
        </ul>
      )}
      {seats.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t("sessionsTitle")}</h2>
          <ul className="mt-4 grid gap-3">
            {seats.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                businessId={businessId}
                canDecide={canDecide}
                now={now}
                timezone={place.timezone}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
