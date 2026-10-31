import { after } from "next/server";

/** Work running detached (outside a request), so scripts and tests can wait for it before they move on. */
const detached = new Set<Promise<unknown>>();

/**
 * Runs side work (emails, audit logs, usage records) after the response is sent, so a slow or failing dependency
 * never slows down or breaks the request. Outside a request (cron scripts, tests) it simply runs detached.
 * Failures are logged.
 */
export function inBackground(label: string, work: () => Promise<unknown>): void {
  const run = () =>
    work().catch((error: unknown) => {
      console.error(`[background] ${label} failed`, error);
    });
  try {
    after(run);
  } catch {
    const task = run();
    detached.add(task);
    void task.finally(() => detached.delete(task));
  }
}

/**
 * Waits until every detached piece of work has finished, including work it started. Tests call it before emptying
 * the database, so a previous test's emails never read tables that are being truncated.
 */
export async function settleBackgroundWork(): Promise<void> {
  while (detached.size > 0) await Promise.allSettled([...detached]);
}
