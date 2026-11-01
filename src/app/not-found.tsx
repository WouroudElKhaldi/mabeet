import { getTranslations } from "next-intl/server";
import { MessagePage } from "@/components/shell/message-page";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <MessagePage title={t("notFoundTitle")} body={t("notFoundBody")}>
      <ButtonLink href="/">{t("home")}</ButtonLink>
    </MessagePage>
  );
}
