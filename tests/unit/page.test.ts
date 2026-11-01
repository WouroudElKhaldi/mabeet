import { describe, expect, it, vi } from "vitest";
import { conflict, notFound } from "@/server/errors";

const shown404 = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw shown404;
  },
}));

const { findPageOr404 } = await import("@/server/http/page");

// A server page reads through a service; what the service cannot find must become the 404 page, not a crash.

describe("findPageOr404", () => {
  it("gives the page what the service found", async () => {
    await expect(findPageOr404(Promise.resolve({ amount: "10.00" }))).resolves.toEqual({ amount: "10.00" });
  });

  it("shows the 404 page when the service says it does not exist", async () => {
    await expect(findPageOr404(Promise.reject(notFound("Payment")))).rejects.toBe(shown404);
  });

  it("lets any other failure through, so it is not hidden as a missing page", async () => {
    const refused = conflict("Those dates were just taken");
    await expect(findPageOr404(Promise.reject(refused))).rejects.toBe(refused);
  });
});
