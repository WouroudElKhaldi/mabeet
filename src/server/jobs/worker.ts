import { settleBackgroundWork } from "@/server/background";
import { type Payload, QUEUES, type QueueName, runPayload, startBoss } from "./queue";
import { SCHEDULES } from "./registry";

// The worker process: `pnpm worker`. It runs every queued job and the schedules, as many at once per queue as
// QUEUES allows. Run more copies of it to share the load; pg-boss hands each job to exactly one of them.

const SHUTDOWN_GRACE_MS = 60_000;

async function main() {
  const boss = await startBoss({ supervise: true, schedule: true });

  for (const [name, { concurrency }] of Object.entries(QUEUES) as Array<
    [QueueName, { concurrency: number }]
  >) {
    await boss.work<Payload>(name, { localConcurrency: concurrency, batchSize: 1 }, async ([job]) =>
      runPayload(job!.data, job!.id).catch((error: unknown) => {
        // Logged here because pg-boss only stores it on the job; it retries the job if it has retries left.
        console.error(`[worker] ${job!.data.job} failed (attempt ${job!.retryCount + 1})`, error);
        throw error;
      }),
    );
  }

  for (const { job, cron } of SCHEDULES) {
    await boss.schedule(job.queue, cron, { job: job.kind, data: {} } satisfies Payload, {
      key: job.kind,
      tz: "UTC",
    });
  }

  console.warn(`[worker] running queues: ${Object.keys(QUEUES).join(", ")}`);

  // A deploy stops the container: finish the jobs in hand, then exit.
  const stop = async (signal: string) => {
    console.warn(`[worker] ${signal}: finishing the jobs in hand`);
    await boss.stop({ graceful: true, timeout: SHUTDOWN_GRACE_MS });
    await settleBackgroundWork();
    process.exit(0);
  };
  process.once("SIGTERM", () => void stop("SIGTERM"));
  process.once("SIGINT", () => void stop("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});
