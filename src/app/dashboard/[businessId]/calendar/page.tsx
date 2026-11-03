import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { EXPIRING_BOOKING_STATUSES } from "@/config/enums";
import { CalendarBoard, type CalendarEntry } from "@/modules/bookings";
import { getCalendar, getCalendarBoard } from "@/modules/bookings/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { addDays, parseIsoDate, toIsoDate, todayUtc } from "@/utils/dates";

type PageProps = { params: Promise<{ businessId: string }>; searchParams: Promise<{ month?: string }> };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Six weeks: every month fits, with its neighbours' days around it. */
const GRID_DAYS = 42;
/** "Coming up" looks a week ahead, today included. */
const COMING_UP_DAYS = 8;

/**
 * The place's calendar: every booking, closed date and platform stay of a month (`?month=2026-11`), the chosen day or
 * stay beside it, and what is coming up this week. Members who may close dates do it from here.
 */
export default async function CalendarPage({ params, searchParams }: PageProps) {
  const [{ businessId }, { month: asked }] = await Promise.all([params, searchParams]);
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.calendar.anyOf);
  const today = todayUtc();
  const month = asked && MONTH.test(asked) ? asked : toIsoDate(today).slice(0, 7);
  const first = parseIsoDate(`${month}-01`);
  // The grid starts on the Monday on or before the 1st.
  const gridStart = addDays(first, -((first.getUTCDay() + 6) % 7));
  const [t, { rooms, occupancy }, comingUp] = await Promise.all([
    getTranslations("dashboard.calendar"),
    getCalendarBoard(ctx, { from: gridStart, to: addDays(gridStart, GRID_DAYS) }),
    getCalendar(ctx, { from: today, to: addDays(today, COMING_UP_DAYS) }),
  ]);

  const toEntry = (row: (typeof occupancy)[number]): CalendarEntry => ({
    id: row.id,
    roomId: row.roomId,
    checkIn: toIsoDate(row.checkIn),
    checkOut: toIsoDate(row.checkOut),
    kind: row.kind,
    conflict: row.conflict,
    pending: (EXPIRING_BOOKING_STATUSES as readonly string[]).includes(row.booking?.status ?? ""),
    reference: row.booking?.reference ?? null,
    label: row.booking?.guestName ?? row.note ?? t(`sources.${row.feed?.source ?? "NONE"}`),
  });

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <CalendarBoard
        businessId={businessId}
        month={month}
        gridStart={toIsoDate(gridStart)}
        today={toIsoDate(today)}
        rooms={rooms}
        entries={occupancy.map(toEntry)}
        comingUp={comingUp.map(toEntry)}
        canEditBlocks={can(ctx, "blocks.manage")}
      />
    </>
  );
}
