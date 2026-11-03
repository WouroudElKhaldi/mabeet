import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE, LOCALES } from "@/config/appearance";

const { setCookie, revalidatePath, getCurrentUser, setMyLocale } = vi.hoisted(() => ({
  setCookie: vi.fn(),
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  setMyLocale: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/http/session", () => ({ getCurrentUser }));
vi.mock("@/modules/accounts/server", () => ({ setMyLocale }));

const { setLocale } = await import("@/app/actions/locale");

beforeEach(() => {
  setCookie.mockClear();
  revalidatePath.mockClear();
  setMyLocale.mockClear();
  getCurrentUser.mockReset().mockResolvedValue(null);
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
    expect(setMyLocale).not.toHaveBeenCalled();
  });

  it("keeps a signed-in person's choice on their account, so their emails follow it", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", locale: "en" });
    await setLocale("ar-LB");
    expect(setMyLocale).toHaveBeenCalledWith("user-1", "ar-LB");
  });

  it("writes nothing to the account for a visitor, or when the language is already theirs", async () => {
    await setLocale("ar");
    getCurrentUser.mockResolvedValue({ id: "user-1", locale: "ar" });
    await setLocale("ar");
    expect(setMyLocale).not.toHaveBeenCalled();
    expect(setCookie).toHaveBeenCalledTimes(2);
  });
});
