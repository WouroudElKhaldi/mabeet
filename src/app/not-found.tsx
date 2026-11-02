import { getTranslations } from "next-intl/server";
import { MessagePage } from "@/components/shell/message-page";
import { ButtonLink } from "@/components/ui/button";

/** A page that does not exist: Mount Lebanon at dusk, a big 404 and the way home. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <MessagePage mark="404" title={t("notFoundTitle")} body={t("notFoundBody")}>
      <ButtonLink href="/">{t("home")}</ButtonLink>
    </MessagePage>
  );
}
