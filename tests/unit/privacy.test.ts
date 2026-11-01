import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/utils/privacy";

// Team members without guests.contact see a booking, but not how to reach the guest.

describe("hiding a guest's contact", () => {
  it("keeps the country code and the last four digits of a phone, enough to recognise it", () => {
    expect(maskPhone("+96171123456")).toBe("+961••••3456");
    expect(maskPhone("+96171123456")).not.toContain("71123");
  });

  it("hides a short number completely, since its last digits would be most of it", () => {
    expect(maskPhone("12345678")).toBe("••••••••");
    expect(maskPhone("")).toBe("");
  });

  it("keeps the first letter and the domain of an email", () => {
    expect(maskEmail("maya@example.com")).toBe("m•••@example.com");
    expect(maskEmail("maya.haddad@gmail.com")).not.toContain("haddad");
  });
});
