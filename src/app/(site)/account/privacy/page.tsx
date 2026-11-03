import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountHeader, PrivacyControls } from "@/modules/accounts";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("tabs.privacy") };
}

/**
 * The guest's own data: download everything Mabeet holds about them, or delete the account. A signed-out visitor
 * signs in and comes straight back.
 */
export default async function AccountPrivacyPage() {
  const user = await requirePageUser("/account/privacy");
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 pb-16 sm:px-6 lg:px-10">
      <AccountHeader name={user.name} />
      <div className="mt-10 max-w-3xl">
        <PrivacyControls email={user.email} />
      </div>
    </div>
  );
}
