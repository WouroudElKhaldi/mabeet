import { describe, expect, it } from "vitest";
import { phone } from "@/lib/schemas";
import { normalizePhone } from "@/utils/phone";

describe("normalizePhone", () => {
  it("assumes Lebanon for a number with no country", () => {
    expect(normalizePhone("71 123 456")).toBe("+96171123456");
    expect(normalizePhone("71123456")).toBe("+96171123456");
    expect(normalizePhone("3 123 456")).toBe("+9613123456");
  });

  it("drops the local leading zero", () => {
    expect(normalizePhone("03 123 456")).toBe("+9613123456");
    expect(normalizePhone("03-123456")).toBe("+9613123456");
    expect(normalizePhone("(01) 234 567")).toBe("+9611234567");
  });

  it("turns the 00 prefix into a plus", () => {
    expect(normalizePhone("0096171123456")).toBe("+96171123456");
    expect(normalizePhone("00 44 20 7946 0958")).toBe("+442079460958");
  });

  it("keeps a number that already has its country, whatever the spaces and dashes", () => {
    expect(normalizePhone("+961 71 123 456")).toBe("+96171123456");
    expect(normalizePhone("+961-71-123-456")).toBe("+96171123456");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("  +961 (71) 123 456  ")).toBe("+96171123456");
  });

  it("reads a long number with no plus as international", () => {
    expect(normalizePhone("96171123456")).toBe("+96171123456");
    expect(normalizePhone("442079460958")).toBe("+442079460958");
  });

  it("moves a stray plus to the front and ignores letters and extra plus signs", () => {
    expect(normalizePhone("++961 71 123 456")).toBe("+96171123456");
    expect(normalizePhone("tel: 71 123 456")).toBe("+96171123456");
  });

  it("gives an empty answer for nothing usable", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("+")).toBe("");
  });

  it("makes what the booking's own check accepts out of the ways Lebanese guests write a number", () => {
    for (const typed of ["71 123 456", "03 123 456", "+961 71 123 456", "0096171123456", "76-123-456"]) {
      expect(phone.safeParse(normalizePhone(typed)).success, typed).toBe(true);
    }
  });

  it("leaves what is too short or too long to the booking's check, which refuses it", () => {
    expect(phone.safeParse(normalizePhone("123")).success).toBe(false);
    expect(phone.safeParse(normalizePhone("1234567890123456789")).success).toBe(false);
  });
});
