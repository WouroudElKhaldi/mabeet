import { describe, expect, it } from "vitest";
import { createAnswerHolder } from "@/components/ui/confirm-dialog";

// `useConfirm` lets a screen write `const answer = await confirm(...)`. These cases make sure that promise always
// ends: with the person's answer, or with "no" when the question is replaced or abandoned.

describe("createAnswerHolder", () => {
  it("gives the answer to the screen that asked", async () => {
    const holder = createAnswerHolder<{ reason: string }>();
    const asked = holder.ask();
    holder.answer({ reason: "wrong dates" });
    expect(await asked).toEqual({ reason: "wrong dates" });
  });

  it("gives null when the person went back", async () => {
    const holder = createAnswerHolder<{ reason: string }>();
    const asked = holder.ask();
    holder.answer(null);
    expect(await asked).toBeNull();
  });

  it("answers the first question with null when a second one is asked, and the second gets its own answer", async () => {
    const holder = createAnswerHolder<string>();
    const first = holder.ask();
    const second = holder.ask();
    holder.answer("yes");
    expect(await first).toBeNull();
    expect(await second).toBe("yes");
  });

  it("ignores an answer when nothing is waiting, and a second answer to the same question", async () => {
    const holder = createAnswerHolder<string>();
    expect(() => holder.answer("yes")).not.toThrow();
    const asked = holder.ask();
    holder.answer("first");
    holder.answer("second");
    expect(await asked).toBe("first");
  });
});
