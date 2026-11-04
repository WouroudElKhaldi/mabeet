"use client";

import { CloudLightning, House, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MessagePage } from "@/components/shell/message-page";
import { Button, ButtonLink } from "@/components/ui/button";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";

const LAST_RELOAD_KEY = "mabeet:error-reload";
const RELOAD_AT_MOST_EVERY_MS = 60_000;

/**
 * An error without a digest happened in the browser, most often a page left open while a deploy restarts the site. A
 * full reload goes through nginx: its "Back in a moment" page, or the new version. Once a minute at most, so a real
 * bug shows the error page instead of reloading forever. Blocked storage means no reload, for the same reason.
 */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_AT_MOST_EVERY_MS) return;
    sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

// Shown when a page fails while it is being built. Never the error itself: a guest sees a calm sentence and a way on.
// The reference (Next's digest of the error) is safe to show, and lets us find the full error in the server logs.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
    if (!error.digest) reloadOnce();
  }, [error]);

  return (
    <MessagePage
      mark={<CloudLightning className="float size-[0.8em]" strokeWidth={1.4} aria-hidden />}
      title={t("errorTitle")}
      body={t("errorBody")}
      footnote={error.digest ? t("reference", { digest: error.digest }) : undefined}
    >
      <Button onClick={() => retry()} className={slideParent}>
        <SlideLabel icon={RotateCcw}>{t("retry")}</SlideLabel>
      </Button>
      <ButtonLink href="/" variant="secondary" className={slideParent}>
        <SlideLabel icon={House}>{t("home")}</SlideLabel>
      </ButtonLink>
    </MessagePage>
  );
}
