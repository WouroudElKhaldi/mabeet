"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MessagePage } from "@/components/shell/message-page";
import { Button, ButtonLink } from "@/components/ui/button";

// Shown when a page fails while it is being built. Never the error itself: a guest sees a calm sentence and a way on.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MessagePage title={t("errorTitle")} body={t("errorBody")}>
      <Button onClick={() => retry()}>{t("retry")}</Button>
      <ButtonLink href="/" variant="secondary">
        {t("home")}
      </ButtonLink>
    </MessagePage>
  );
}
