import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountHeader } from "@/modules/accounts";
import { PhoneAlerts } from "@/modules/notifications";
import { pushPublicKey } from "@/modules/notifications/server";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("tabs.notifications") };
}

/**
 * One place for everyone (guests, hosts, staff) to get on this device every update they are emailed. A signed-out
 * visitor signs in and comes straight back.
 */
export default async function AccountNotificationsPage() {
  const user = await requirePageUser("/account/notifications");
  const t = await getTranslations("pwa");
  const publicKey = pushPublicKey();
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 pb-16 sm:px-6 lg:px-10">
      <AccountHeader name={user.name} />
      <div className="mt-10 max-w-3xl">
        {publicKey ? (
          <PhoneAlerts publicKey={publicKey} />
        ) : (
          <p className="rounded-2xl bg-surface-2 p-6 text-sm text-muted">{t("notSetUp")}</p>
        )}
      </div>
    </div>
  );
}
