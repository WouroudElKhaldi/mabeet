import { getTranslations } from "next-intl/server";
import { MessagePage } from "@/components/shell/message-page";
import { ButtonLink } from "@/components/ui/button";

/** Something a public page could not find (a place no longer listed, someone else's booking), inside the site's frame. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <MessagePage framed mark="404" title={t("notFoundTitle")} body={t("notFoundBody")}>
      <ButtonLink href="/">{t("home")}</ButtonLink>
    </MessagePage>
  );
}
