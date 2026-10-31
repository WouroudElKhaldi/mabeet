import { describe, expect, it } from "vitest";
import { afterSignIn, signInUrl } from "@/utils/sign-in-url";

describe("coming back after signing in", () => {
  it("returns to a page on this site, such as the booking the guest started", () => {
    expect(afterSignIn("/p/beit-batroun/book?room=r1")).toBe("/p/beit-batroun/book?room=r1");
    expect(signInUrl("/b/abc")).toBe("/sign-in?next=%2Fb%2Fabc");
  });

  it("never sends anyone to another website", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "evil.example",
      null,
      undefined,
    ]) {
      expect(afterSignIn(next)).toBe("/home");
    }
  });
});
