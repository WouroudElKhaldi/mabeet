import { afterEach, describe, expect, it, vi } from "vitest";
import { inBackground, settleBackgroundWork } from "@/server/background";

// Outside a request, Next's after() throws, so inBackground runs the work detached: the path tests and cron use.

afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("inBackground", () => {
  it("runs the work without making the caller wait for it", async () => {
    let finished = false;
    inBackground("slow work", async () => {
      await flush();
      finished = true;
    });
    expect(finished).toBe(false);
    await flush();
    await flush();
    expect(finished).toBe(true);
  });

  it("never lets a failing email or push reach the caller; it is logged instead", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      inBackground("booking email", async () => {
        throw new Error("mail provider down");
      }),
    ).not.toThrow();
    await flush();
    expect(logged).toHaveBeenCalledWith("[background] booking email failed", expect.any(Error));
  });

  it("lets tests wait for detached work, including work that work started", async () => {
    const done: string[] = [];
    inBackground("email", async () => {
      await flush();
      inBackground("push", async () => {
        await flush();
        done.push("push");
      });
      done.push("email");
    });
    await settleBackgroundWork();
    expect(done).toEqual(["email", "push"]);
  });
});
