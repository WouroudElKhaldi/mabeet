import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConsentButtons } from "@/modules/assistant";
import { describeConsent } from "@/modules/assistant/server";
import { getCurrentSession } from "@/server/http/session";

type PageProps = { searchParams: Promise<{ client_id?: string; scope?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("oauth");
  return { title: t("consentTitle", { app: t("anApp") }), robots: { index: false } };
}

/** Each OAuth scope an app may ask for, as its plain-words line on this page. */
const SCOPE_TEXT = {
  "mcp:read": "scopes.mcp_read",
  offline_access: "scopes.offline_access",
  profile: "scopes.profile",
} as const;
const SCOPE_KEYS = Object.keys(SCOPE_TEXT) as Array<keyof typeof SCOPE_TEXT>;

/** Step 3: what the app asks for, in plain words, and where. Nothing is shared until Allow. */
export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const { client_id: clientId, scope = "" } = await searchParams;
  const session = await getCurrentSession();
  if (!session || !clientId) redirect("/sign-in");
  const [t, consent] = await Promise.all([
    getTranslations("oauth"),
    describeConsent(session.user.id, session.session.mcpBusinessId, clientId),
  ]);
  const asked = new Set(scope.split(" "));
  const shown = SCOPE_KEYS.filter((key) => asked.has(key) || (key === "profile" && asked.has("email")));

  return (
    <>
      <p className="rise-in text-xs font-bold tracking-[0.16em] text-accent uppercase">{t("kicker")}</p>
      <h1 className="rise-in mt-3 font-poster text-[2rem]">
        {t("consentTitle", { app: consent.appName ?? t("anApp") })}
      </h1>
      {consent.businessName && (
        <p className="mt-3 text-muted">{t("consentWhere", { business: consent.businessName })}</p>
      )}
      <ul className="mt-6 mb-8 grid gap-3">
        {shown.map((key) => (
          <li key={key} className="flex gap-3 text-[0.9375rem]">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            {t(SCOPE_TEXT[key])}
          </li>
        ))}
      </ul>
      <ConsentButtons />
      <p className="mt-6 text-xs text-muted">{t("revokeHint")}</p>
    </>
  );
}
