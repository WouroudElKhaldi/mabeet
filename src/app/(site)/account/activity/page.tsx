import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { AccountHeader } from "@/modules/accounts";
import { ActivityList } from "@/modules/directory";
import { listMyActivity } from "@/modules/directory/server";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("tabs.activity") };
}

/** What the guest did on Mabeet and what happened to their bookings, newest first. */
export default async function ActivityPage() {
  const user = await requirePageUser("/account/activity");
  const [t, items] = await Promise.all([getTranslations("account"), listMyActivity(user.id)]);

  return (
    <div className="mx-auto max-w-280 px-4 pt-10 pb-16 sm:px-6 lg:px-10">
      <AccountHeader name={user.name} />
      <div className="mt-10 max-w-3xl">
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-xl bg-surface-2 p-6">
            <p className="text-lg font-semibold">{t("activity.empty")}</p>
            <ButtonLink href="/search">{t("explore")}</ButtonLink>
          </div>
        ) : (
          <ActivityList items={items} />
        )}
      </div>
    </div>
  );
}
