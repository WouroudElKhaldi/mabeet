import { beforeEach, describe, expect, it, vi } from "vitest";
import { forbidden } from "@/server/errors";

// The queue against a stand-in pg-boss: what matters here is where a job goes (the queue, or this process) and
// how its outcome is reported to the worker.

const env = vi.hoisted(() => ({
  JOBS_MODE: "queue" as "inline" | "queue",
  DATABASE_URL: "postgres://test",
}));
vi.mock("@/server/env", () => ({ env }));

const boss = vi.hoisted(() => ({
  existing: [] as string[],
  created: [] as string[],
  sent: [] as Array<{ queue: string; data: object }>,
}));
vi.mock("pg-boss", () => ({
  PgBoss: class {
    on() {}
    async start() {}
    async getQueues() {
      return boss.existing.map((name) => ({ name }));
    }
    async createQueue(name: string) {
      boss.created.push(name);
    }
    async send(queue: string, data: object) {
      boss.sent.push({ queue, data });
      return `job-${boss.sent.length}`;
    }
  },
}));

const { settleBackgroundWork } = await import("@/server/background");
const { defineJob, QUEUES, runPayload, startBoss } = await import("@/server/jobs/queue");

const sendNotice = vi.fn(async ({ to }: { to: string }) => `sent to ${to}`);
const notice = defineJob("notify", "test.notice", sendNotice);

beforeEach(() => {
  boss.existing = [];
  boss.created.length = 0;
  boss.sent.length = 0;
  sendNotice.mockClear();
  env.JOBS_MODE = "queue";
});

describe("putting a job on its queue", () => {
  it("sends its kind and data to the queue, without running it here", async () => {
    await expect(notice.enqueue({ to: "rana" })).resolves.toBe("job-1");
    expect(boss.sent).toEqual([{ queue: "notify", data: { job: "test.notice", data: { to: "rana" } } }]);
    expect(sendNotice).not.toHaveBeenCalled();
  });

  it("runs it in this process instead when there is no worker (inline mode)", async () => {
    env.JOBS_MODE = "inline";
    await expect(notice.enqueue({ to: "karim" })).resolves.toBeNull();
    await settleBackgroundWork();
    expect(sendNotice).toHaveBeenCalledWith({ to: "karim" }, null);
    expect(boss.sent).toEqual([]);
  });
});

describe("the worker running a job", () => {
  it("finds the handler by the job's kind and passes pg-boss's job id", async () => {
    await expect(runPayload({ job: "test.notice", data: { to: "maya" } }, "job-7")).resolves.toEqual({
      ok: true,
      result: "sent to maya",
    });
    expect(sendNotice).toHaveBeenCalledWith({ to: "maya" }, "job-7");
  });

  it("ends a job the person caused to fail at once, with only its safe message", async () => {
    defineJob("notify", "test.refused", async () => {
      throw forbidden("Not yours");
    });
    await expect(runPayload({ job: "test.refused", data: {} }, "job-8")).resolves.toEqual({
      ok: false,
      error: { code: "FORBIDDEN", status: 403, message: "Not yours" },
    });
  });

  it("throws any other failure, so pg-boss retries the job", async () => {
    defineJob("notify", "test.outage", async () => {
      throw new Error("mail server down");
    });
    await expect(runPayload({ job: "test.outage", data: {} }, "job-9")).rejects.toThrow("mail server down");
  });

  it("refuses a job whose kind no module declared", async () => {
    await expect(runPayload({ job: "test.unknown", data: {} }, "job-10")).rejects.toThrow(
      'No handler for job "test.unknown"',
    );
  });
});

describe("starting pg-boss", () => {
  it("creates only the queues that do not exist yet", async () => {
    boss.existing = ["notify"];
    await startBoss({ supervise: true, schedule: true });
    expect(boss.created).toEqual(Object.keys(QUEUES).filter((name) => name !== "notify"));
  });
});
