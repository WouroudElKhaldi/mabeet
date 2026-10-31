// Every module that declares jobs, imported for its side effect: declaring a job registers its handler. The worker
// imports this file, so a job declared anywhere else must be added here or the worker will refuse it. This is the
// one kernel file that reaches into modules: it is where the worker is put together.
import "@/modules/team/server/team-notifications";

export { SCHEDULES } from "@/modules/housekeeping/server/housekeeping-jobs";
