import { Luggage } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/site/eyebrow";
import { Section } from "@/components/site/section";
import { ButtonLink } from "@/components/ui/button";
import { SignOutButton } from "@/modules/accounts";
import { splitTrips, TripList } from "@/modules/directory";
import { listMyTrips } from "@/modules/directory/server";
import { requirePageUser } from "@/server/http/session";
import { toIsoDate, todayUtc } from "@/utils/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("tabs.trips") };
}

/**
 * The guest's trips: what is coming (and what waits for them: a payment, the host), then what is over. Each is a link
 * to its booking page. A signed-out visitor signs in and comes straight back.
 */
export default async function AccountPage() {
  const user = await requirePageUser("/account");
  const [t, trips] = await Promise.all([getTranslations("account"), listMyTrips(user.id)]);
  const { upcoming, past } = splitTrips(trips, toIsoDate(todayUtc()));

  return (
    <div className="mx-auto max-w-280 px-4 pt-10 pb-16 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-4">
          <Eyebrow icon={Luggage}>{t("eyebrow")}</Eyebrow>
          <h1 className="font-poster text-[clamp(1.75rem,3.2vw,2.25rem)]">
            {t("hello", { name: user.name })}
          </h1>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-10 flex max-w-3xl flex-col gap-10">
        {trips.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-xl bg-surface-2 p-6">
            <p className="text-lg font-semibold">{t("noTrips")}</p>
            <ButtonLink href="/">{t("explore")}</ButtonLink>
          </div>
        ) : null}
        {upcoming.length > 0 ? (
          <Section id="upcoming" title={t("upcoming")}>
            <TripList trips={upcoming} />
          </Section>
        ) : null}
        {past.length > 0 ? (
          <Section id="past" title={t("past")}>
            <TripList trips={past} />
          </Section>
        ) : null}
      </div>
    </div>
  );
}
