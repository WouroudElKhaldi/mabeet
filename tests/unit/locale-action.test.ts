import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE, LOCALES } from "@/config/appearance";

const { setCookie, revalidatePath } = vi.hoisted(() => ({ setCookie: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { setLocale } = await import("@/app/actions/locale");

beforeEach(() => {
  setCookie.mockClear();
  revalidatePath.mockClear();
});

describe("setLocale", () => {
  it.each(LOCALES)("saves %s for a year, for this site only, out of reach of scripts", async (locale) => {
    await setLocale(locale);
    expect(setCookie).toHaveBeenCalledWith(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });
  });

  it("builds every page again in the new language", async () => {
    await setLocale("ar");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a language the site does not have, and saves nothing", async () => {
    for (const unknown of ["fr", "AR", "ar-lb", "", "en; Path=/admin"]) {
      await expect(setLocale(unknown)).rejects.toThrow();
    }
    expect(setCookie).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
