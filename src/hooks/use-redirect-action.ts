"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { errorMessage } from "@/lib/api-client";

/**
 * Where our own server may send a visitor: a page of this site (by path, or by full address, which is http on a
 * computer running the site, as the Whish simulator's page is there), or an https address (Stripe, Whish...).
 */
export function isSafeRedirect(url: unknown, siteOrigin: string): url is string {
  if (typeof url !== "string" || /[\\\u0000-\u001f]/.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  try {
    const target = new URL(url);
    return target.protocol === "https:" || target.origin === siteOrigin;
  } catch {
    return false;
  }
}

/**
 * For a step that ends on another page: the API answers `{ url }` and the visitor is taken there (the payment page,
 * an AI app's sign-in). `pending` stays true while the page is leaving, so the button cannot be pressed twice.
 */
export function useRedirectAction() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<{ url: string }>): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const { url } = await work();
      if (!isSafeRedirect(url, window.location.origin))
        throw new Error("The server sent an address this site does not follow");
      if (url.startsWith("/")) router.push(url);
      else window.location.assign(url);
    } catch (caught) {
      setError(errorMessage(caught, t("error")));
      setPending(false);
    }
  }

  return { run, pending, error };
}
