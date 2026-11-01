"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALES } from "@/config/appearance";
import { setMyLocale } from "@/modules/accounts/server";
import { getCurrentUser } from "@/server/http/session";

const localeSchema = z.enum(LOCALES);

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Saves the visitor's language. A server action is a public endpoint, so the value is checked like any input. */
export async function setLocale(locale: string) {
  const checked = localeSchema.parse(locale);
  (await cookies()).set(LOCALE_COOKIE, checked, {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
    // Only the server reads it, and it holds no secret, so no `secure` flag is needed.
    httpOnly: true,
  });
  // A signed-in person's emails follow the language they chose here.
  const user = await getCurrentUser();
  if (user && user.locale !== checked) await setMyLocale(user.id, checked);
  // Every page already built for the old language is built again.
  revalidatePath("/", "layout");
}
