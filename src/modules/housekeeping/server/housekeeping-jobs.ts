import { defineJob } from "@/server/jobs/queue";
import { runHousekeeping } from "./housekeeping-service";

// Scheduled work, run by the worker on the "cron" queue. pg-boss keeps the schedule in the database, so with
// several workers each run still happens once.

const housekeeping = defineJob("cron", "cron.housekeeping", async () => {
  console.warn("[cron] housekeeping", await runHousekeeping());
});

/** Cron expressions in UTC. */
export const SCHEDULES = [{ job: housekeeping, cron: "*/5 * * * *" }] as const;
