import { Luggage } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/site/eyebrow";
import { AccountTabs } from "./account-tabs";
import { SignOutButton } from "./sign-out-button";

/** The top of every account page: the greeting with Sign out, then the tabs. */
export async function AccountHeader({ name }: { name: string }) {
  const t = await getTranslations("account");
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-4">
          <Eyebrow icon={Luggage}>{t("eyebrow")}</Eyebrow>
          <h1 className="font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]">{t("hello", { name })}</h1>
        </div>
        <SignOutButton />
      </div>
      <div className="mt-8">
        <AccountTabs />
      </div>
    </>
  );
}
