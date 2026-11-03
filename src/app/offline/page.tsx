import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MessagePage } from "@/components/shell/message-page";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pwa");
  return { title: t("offlineTitle"), robots: { index: false, follow: false } };
}

/**
 * What the browser shows when there is no connection: the service worker (public/sw.js) keeps a copy of this page
 * with its stylesheets, fonts and logo. It is shown with no JavaScript, so "Try again" is a plain link that loads
 * the address the visitor asked for again.
 */
export default async function OfflinePage() {
  const [t, errors] = await Promise.all([getTranslations("pwa"), getTranslations("errors")]);
  return (
    <MessagePage
      mark={<WifiOff className="float size-[0.7em]" strokeWidth={1.4} aria-hidden />}
      title={t("offlineTitle")}
      body={t("offlineBody")}
    >
      {/* An empty href is the current address, which the browser fetches again. */}
      <a href="" className={buttonClass()}>
        {errors("retry")}
      </a>
    </MessagePage>
  );
}
