import { describe, expect, it } from "vitest";
import { inputDirection } from "@/components/ui/field";

describe("inputDirection", () => {
  it("keeps emails, phone numbers and web addresses left to right, even on an Arabic page", () => {
    expect(inputDirection("email")).toBe("ltr");
    expect(inputDirection("tel")).toBe("ltr");
    expect(inputDirection("url")).toBe("ltr");
  });

  it("leaves every other input to follow the page's direction", () => {
    expect(inputDirection("text")).toBeUndefined();
    expect(inputDirection("password")).toBeUndefined();
    expect(inputDirection(undefined)).toBeUndefined();
  });
});
