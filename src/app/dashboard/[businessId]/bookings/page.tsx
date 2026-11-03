import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { ChoiceLinks } from "@/components/ui/choice-links";
import { BookingRow } from "@/modules/bookings";
import { listBookings } from "@/modules/bookings/server";
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

/** The host's stays, by tab, with Confirm, Decline and Cancel on each row for members who may decide. */
export default async function BookingsPage({ params, searchParams }: PageProps) {
  const [{ businessId }, { tab: asked }] = await Promise.all([params, searchParams]);
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.bookings.anyOf);
  const tab = TABS.find((name) => name === asked) ?? "requests";
  const now = new Date();
  const [t, bookings] = await Promise.all([
    getTranslations("dashboard.bookings"),
    listBookings(ctx, { ...filtersFor(tab, todayUtc(now)), take: PAGE_SIZE, skip: 0 }),
  ]);

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
      {bookings.length === 0 ? (
        <p className="mt-6 text-muted">{t(`emptyTabs.${tab}`)}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              businessId={businessId}
              canDecide={can(ctx, "bookings.decide")}
              now={now}
            />
          ))}
        </ul>
      )}
    </>
  );
}
