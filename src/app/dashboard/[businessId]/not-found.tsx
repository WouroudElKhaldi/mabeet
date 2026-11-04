import { getTranslations } from "next-intl/server";
import { MessagePage } from "@/components/shell/message-page";
import { ButtonLink } from "@/components/ui/button";

/** A dashboard page this member may not open, or a thing that is gone, inside the dashboard's frame. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <MessagePage framed mark="404" title={t("notFoundTitle")} body={t("notFoundBody")}>
      <ButtonLink href="/dashboard">{t("home")}</ButtonLink>
    </MessagePage>
  );
}
