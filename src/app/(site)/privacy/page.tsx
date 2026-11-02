import {
  Bot,
  CalendarSync,
  Cookie,
  CreditCard,
  Download,
  Eye,
  HandCoins,
  type LucideIcon,
  RotateCcw,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReceiptCard } from "@/components/brand/receipt-card";
import { HeroHeading } from "@/components/site/hero-heading";
import { OnThisPage } from "@/components/site/on-this-page";
import { Section } from "@/components/site/section";
import { TopicCard } from "@/components/site/topic-card";
import { stagger } from "@/utils/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title"), description: t("intro") };
}

type Topic = "keep" | "see" | "calendars" | "ai" | "browser" | "rights" | "paying" | "refunds" | "direct";

const GROUPS: Array<{ id: "data" | "money"; topics: Array<[Topic, LucideIcon]> }> = [
  {
    id: "data",
    topics: [
      ["keep", UserRound],
      ["see", Eye],
      ["calendars", CalendarSync],
      ["ai", Bot],
      ["browser", Cookie],
      ["rights", Download],
    ],
  },
  {
    id: "money",
    topics: [
      ["paying", CreditCard],
      ["refunds", RotateCcw],
      ["direct", HandCoins],
    ],
  },
];

/**
 * Privacy, and the payment policy (F17): the promises at a glance on a till receipt, then what we keep and who sees
 * it, then how paying works. Online refunds are always full; a payment made to the host directly is between the
 * guest and the host.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <div className="mx-auto max-w-360 overflow-x-clip px-4 pt-10 pb-12 sm:px-6 lg:px-10">
      <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0">
          <HeroHeading title={t.rich("headline", { em: (chunk) => <em>{chunk}</em> })} intro={t("intro")} />
        </div>
        <div className="rise-in pt-8 lg:pt-0" style={stagger(2)}>
          <ReceiptCard
            title={t("glance.title")}
            lines={[t("glance.card"), t("glance.refunds"), t("glance.tracking"), t("glance.delete")]}
            footer={t("glance.footer")}
          />
        </div>
      </div>
      <div className="mt-20 grid gap-10 lg:grid-cols-[13rem_1fr] lg:gap-16">
        <OnThisPage
          label={t("onThisPage")}
          links={GROUPS.map(({ id }) => ({ id, title: t(`groups.${id}`) }))}
        />
        <div className="grid min-w-0 gap-16">
          {GROUPS.map(({ id, topics }) => (
            <Section key={id} id={id} title={t(`groups.${id}`)} intro={t(`intros.${id}`)}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {topics.map(([topic, icon], index) => (
                  <TopicCard
                    key={topic}
                    icon={icon}
                    number={index + 1}
                    title={t(`${topic}.title`)}
                    body={t(`${topic}.body`)}
                    highlight={topic === "refunds"}
                    style={stagger(index + 1)}
                  />
                ))}
              </div>
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
}
