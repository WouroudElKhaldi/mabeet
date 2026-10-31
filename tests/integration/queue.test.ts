import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRole, inviteMember } from "@/modules/team/server";
import type { Email } from "@/server/email/send";
import { env } from "@/server/env";
import { type Payload, QUEUES, runPayload, startBoss } from "@/server/jobs/queue";
import { createPlace, testEmail } from "./helpers";

// The real pg-boss on the test database, in "queue" mode as in production: a notice is stored on its queue with
// ids only, and the worker's run of it sends the email. Every other test runs jobs inline.

const sent = vi.hoisted(() => [] as Email[]);
vi.mock(import("@/server/email/send"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

let worker: PgBoss;

beforeAll(async () => {
  env.JOBS_MODE = "queue";
  worker = await startBoss({ supervise: false, schedule: false });
});
afterAll(async () => {
  env.JOBS_MODE = "inline";
  await worker.stop({ graceful: false });
});

/** Waits for the website's send, which a notify* call starts without waiting for it. */
async function findQueued(data: object) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const [job] = await worker.findJobs<Payload>("notify", { data: { data }, queued: true });
    if (job) return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("the job never reached the queue");
}

describe("the job queue on Postgres", () => {
  it("creates every queue", async () => {
    const names = (await worker.getQueues()).map((queue) => queue.name);
    expect(names).toEqual(expect.arrayContaining(Object.keys(QUEUES)));
  });

  it("stores an invitation email on the notify queue, and sends it when the worker runs it", async () => {
    const place = await createPlace();
    const role = await createRole(place.ctx, { name: "Cleaner", permissions: ["calendar.read"] });
    const email = testEmail();
    const { id } = await inviteMember(
      place.ctx,
      { name: "Rana Khalil", email, phone: "+96171555111", roleId: role.id },
      "en",
    );

    const job = await findQueued({ invitationId: id });
    // Nothing is sent by the website itself.
    expect(sent).toEqual([]);
    expect(job.data).toEqual({ job: "notify.invitation", data: { invitationId: id } });

    await expect(runPayload(job.data, job.id)).resolves.toEqual({ ok: true, result: undefined });
    expect(sent.map((letter) => letter.to)).toEqual([email]);
    await worker.cancel("notify", job.id);
  });
});
