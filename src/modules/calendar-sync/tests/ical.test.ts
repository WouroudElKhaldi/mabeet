import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseIsoDate, toIsoDate } from "@/utils/dates";
import { buildExportFeed } from "../server/build-feed";
import { parseFeed } from "../server/parse-feed";
import { assertPublicHttpsUrl, fetchCalendarText } from "../server/safe-fetch";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

// Reading Airbnb and Booking.com, and what our own calendar link says. Calendar sync is half of the brief.

const window = { from: parseIsoDate("2026-11-01"), to: parseIsoDate("2027-11-01"), timezone: "Asia/Beirut" };

const calendar = (...events: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Airbnb Inc//Hosting Calendar//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
const event = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const nights = (text: string) =>
  parseFeed(text, window).map((stay) => [stay.uid, toIsoDate(stay.checkIn), toIsoDate(stay.checkOut)]);

describe("reading a platform's calendar", () => {
  it("reads Airbnb-style all-day stays as nights, the check-out night free", () => {
    const text = calendar(
      event(
        "UID:a1@airbnb.com",
        "DTSTART;VALUE=DATE:20261110",
        "DTEND;VALUE=DATE:20261113",
        "SUMMARY:Reserved",
      ),
    );
    expect(nights(text)).toEqual([["a1@airbnb.com", "2026-11-10", "2026-11-13"]]);
  });

  it("reads a date-time as the date it is at the place, and a missing end as one night", () => {
    const text = calendar(
      // 22:30 UTC on the 14th is already the 15th in Beirut.
      event("UID:late", "DTSTART:20261114T223000Z", "DTEND:20261116T090000Z"),
      event("UID:single", "DTSTART;VALUE=DATE:20261120"),
    );
    expect(nights(text)).toEqual([
      ["late", "2026-11-15", "2026-11-16"],
      ["single", "2026-11-20", "2026-11-21"],
    ]);
  });

  it("skips cancelled, past, far, empty and id-less events", () => {
    const text = calendar(
      event("UID:cancelled", "STATUS:CANCELLED", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261112"),
      event("UID:past", "DTSTART;VALUE=DATE:20261001", "DTEND;VALUE=DATE:20261005"),
      event("UID:far", "DTSTART;VALUE=DATE:20280101", "DTEND;VALUE=DATE:20280105"),
      event("UID:empty", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261110"),
      event("DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261112"),
      // A stay that started before the window but is still running is kept.
      event("UID:running", "DTSTART;VALUE=DATE:20261030", "DTEND;VALUE=DATE:20261103"),
    );
    expect(nights(text)).toEqual([["running", "2026-10-30", "2026-11-03"]]);
  });
});

describe("our calendar link", () => {
  it("says only Not available, with an id that never changes, as all-day nights", () => {
    const stay = { id: "occ_1", checkIn: parseIsoDate("2026-11-10"), checkOut: parseIsoDate("2026-11-12") };
    const text = buildExportFeed("Beit Ward · Cedar room", [stay]);
    expect(text).toContain("UID:occ_1@mabeet");
    expect(text).toContain("SUMMARY:Not available");
    expect(text).toContain("DTSTART;VALUE=DATE:20261110");
    expect(text).toContain("DTEND;VALUE=DATE:20261112");
    expect(text).not.toMatch(/ATTENDEE|ORGANIZER|DESCRIPTION/);
    // What we publish reads back as the same nights.
    expect(nights(text)).toEqual([["occ_1@mabeet", "2026-11-10", "2026-11-12"]]);
  });
});

describe("downloading a calendar link safely", () => {
  const resolvesTo = (address: string) =>
    vi.mocked(lookup).mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }] as never);

  beforeEach(() => resolvesTo("54.230.10.1"));
  afterEach(() => vi.unstubAllGlobals());

  it("refuses http, credentials and private addresses", async () => {
    await expect(assertPublicHttpsUrl("http://www.airbnb.com/calendar/ical/1.ics")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(assertPublicHttpsUrl("https://me:secret@example.com/cal.ics")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.10",
      "169.254.169.254",
      "::1",
      "::ffff:10.0.0.1",
    ]) {
      resolvesTo(address);
      await expect(assertPublicHttpsUrl("https://calendar.example.com/a.ics")).rejects.toMatchObject({
        message: "That calendar link points to a private address",
      });
    }
  });

  it("refuses files that are not calendars, and stops files over 2 MB", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Sign in</html>")),
    );
    await expect(fetchCalendarText("https://calendar.example.com/a.ics")).rejects.toMatchObject({
      message: "That link is not an iCal calendar",
    });
    const huge = `BEGIN:VCALENDAR\r\n${"X".repeat(2_100_000)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(huge)),
    );
    await expect(fetchCalendarText("https://calendar.example.com/a.ics")).rejects.toMatchObject({
      message: "That calendar is too large",
    });
  });

  it("never follows a redirect and reads a real calendar", async () => {
    const fetchMock = vi.fn(async () => new Response(calendar()));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCalendarText("https://calendar.example.com/a.ics")).resolves.toContain(
      "BEGIN:VCALENDAR",
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "error" }));
  });
});
