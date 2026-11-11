import { syncDueFeeds } from "@/modules/bookings/server";
import { defineJob } from "@/server/jobs/queue";
import { runHousekeeping } from "./housekeeping-service";

// Scheduled work, run by the worker on the "cron" queue. pg-boss keeps the schedule in the database, so with
// several workers each run still happens once.

const housekeeping = defineJob("cron", "cron.housekeeping", async () => {
  console.warn("[cron] housekeeping", await runHousekeeping());
});

// Each run reads the calendar links not read in the last 10 minutes, so every link is read at least that often.
const calendarSync = defineJob("cron", "cron.calendar-sync", async () => {
  console.warn("[cron] calendar sync", await syncDueFeeds());
});

/** Cron expressions in UTC. */
export const SCHEDULES = [
  { job: housekeeping, cron: "*/5 * * * *" },
  { job: calendarSync, cron: "*/5 * * * *" },
] as const;
