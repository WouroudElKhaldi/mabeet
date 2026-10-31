import { PgBoss } from "pg-boss";
import { inBackground } from "@/server/background";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";

// Background jobs on the app's own Postgres (pg-boss keeps them in its "pgboss" schema). The website only puts
// jobs on a queue; the worker process (`pnpm worker`, src/server/jobs/worker.ts) runs them. With JOBS_MODE
// "inline" (tests, the website started alone, Docker development) there is no worker: jobs run in this process
// after the response.

/** The queues, each with its own retry policy and its own number of jobs the worker runs at once. */
export const QUEUES = {
  // Emails and push notifications. Retried with backoff; emails carry idempotency keys, so a retry never sends twice.
  notify: {
    concurrency: 8,
    options: {
      retryLimit: 4,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 120,
      deleteAfterSeconds: 86_400,
    },
  },
  // Scheduled housekeeping (expiring holds, plan months). One at a time.
  cron: { concurrency: 1, options: { retryLimit: 0, expireInSeconds: 600, deleteAfterSeconds: 86_400 } },
} as const;

export type QueueName = keyof typeof QUEUES;

/**
 * What a job leaves behind: its result, or an error safe to show (an AppError's own message). Errors the user
 * caused end the job at once; anything else is thrown so pg-boss retries it.
 */
type JobOutcome<Result> =
  { ok: true; result: Result } | { ok: false; error: { code: string; status: number; message: string } };

/** What is stored for a job: its kind, so one queue can hold several kinds of work, and its data kept apart from it. */
export type Payload = { job: string; data: object };

interface JobDefinition<Data> {
  readonly queue: QueueName;
  readonly kind: string;
  /** Puts the job on its queue and returns its id; inline mode runs it after the response and returns null. */
  enqueue(data: Data): Promise<string | null>;
}

/** A job's code. `jobId` is pg-boss's id in the worker, null when the job runs inline. */
type Handler<Data, Result> = (data: Data, jobId: string | null) => Promise<Result>;

const handlers = new Map<string, Handler<unknown, unknown>>();

/** Declares a kind of job. Modules that declare jobs are listed in ./registry.ts, so the worker knows them all. */
export function defineJob<Data extends object, Result = void>(
  queue: QueueName,
  kind: string,
  handler: Handler<Data, Result>,
): JobDefinition<Data> {
  // A later definition replaces an earlier one, as when Next reloads a changed module in development.
  handlers.set(kind, handler as Handler<unknown, unknown>);
  return {
    queue,
    kind,
    async enqueue(data) {
      if (env.JOBS_MODE === "inline") {
        inBackground(kind, () => handler(data, null));
        return null;
      }
      return (await queueClient()).send(queue, { job: kind, data } satisfies Payload);
    },
  };
}

async function settle<Result>(work: Promise<Result>): Promise<JobOutcome<Result>> {
  try {
    return { ok: true, result: await work };
  } catch (error) {
    if (error instanceof AppError)
      return { ok: false, error: { code: error.code, status: error.status, message: error.message } };
    throw error;
  }
}

/** The worker's entry for every job on a queue: finds its handler by kind. */
export async function runPayload(payload: Payload, jobId: string): Promise<JobOutcome<unknown>> {
  const handler = handlers.get(payload.job);
  if (!handler) throw new Error(`No handler for job "${payload.job}"`);
  return settle(handler(payload.data, jobId));
}

// ---------- The connection ----------

const globalForBoss = globalThis as unknown as { boss?: Promise<PgBoss> };

/**
 * The website's connection: it sends jobs but never runs or schedules them, so it starts without pg-boss's
 * maintenance and cron loops. One per process.
 */
function queueClient(): Promise<PgBoss> {
  globalForBoss.boss ??= startBoss({ supervise: false, schedule: false }).catch((error: unknown) => {
    globalForBoss.boss = undefined;
    throw error;
  });
  return globalForBoss.boss;
}

/** Connects, installs or migrates the pgboss schema when needed, and makes sure every queue exists. */
export async function startBoss(options: { supervise: boolean; schedule: boolean }): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    application_name: "mabeet-jobs",
    max: 4,
    ...options,
  });
  boss.on("error", (error) => console.error("[jobs]", error));
  await boss.start();
  const existing = new Set((await boss.getQueues()).map((queue) => queue.name));
  for (const [name, { options: queueOptions }] of Object.entries(QUEUES)) {
    if (!existing.has(name)) await boss.createQueue(name, queueOptions);
  }
  return boss;
}
