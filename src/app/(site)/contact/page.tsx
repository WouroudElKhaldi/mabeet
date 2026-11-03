import { CalendarCheck, HousePlus, MessagesSquare, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TicketCard } from "@/components/brand/ticket-card";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Eyebrow } from "@/components/site/eyebrow";
import { HeroHeading } from "@/components/site/hero-heading";
import { TopicCard } from "@/components/site/topic-card";
import { ArrowLink } from "@/components/ui/arrow-link";
import { ContactForm } from "@/modules/contact";
import { env } from "@/server/env";
import { stagger } from "@/utils/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title"), description: t("intro") };
}

/**
 * Contact us (approved by Sami, 2026-11-02): a message form that reaches the team's inbox (`CONTACT_EMAIL`) and a
 * WhatsApp chat (`CONTACT_WHATSAPP`), each shown only when set, and where each kind of question is answered best.
 */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  const intro = env.CONTACT_EMAIL
    ? t("cardIntro")
    : env.CONTACT_WHATSAPP
      ? t("orWhatsapp")
      : t("unavailable");

  return (
    <div className="mx-auto grid max-w-360 gap-16 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <div className="min-w-0">
        <Eyebrow icon={MessagesSquare}>{t("eyebrow")}</Eyebrow>
        <div className="mt-5">
          <HeroHeading title={t.rich("headline", { em: (chunk) => <em>{chunk}</em> })} intro={t("intro")} />
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <TopicCard
            number={1}
            icon={CalendarCheck}
            title={t("topics.booking.title")}
            body={t("topics.booking.body")}
            style={stagger(2)}
          />
          <TopicCard
            number={2}
            icon={HousePlus}
            title={t("topics.hosting.title")}
            body={t("topics.hosting.body")}
            action={<ArrowLink href="/host">{t("topics.hosting.link")}</ArrowLink>}
            style={stagger(3)}
          />
          <TopicCard
            number={3}
            icon={ShieldCheck}
            title={t("topics.privacy.title")}
            body={t("topics.privacy.body")}
            action={<ArrowLink href="/privacy">{t("topics.privacy.link")}</ArrowLink>}
            style={stagger(4)}
          />
        </div>
      </div>
      <TicketCard sticky title={t("cardTitle")} intro={intro}>
        {env.CONTACT_EMAIL || env.CONTACT_WHATSAPP ? (
          <div className="grid gap-6">
            {env.CONTACT_EMAIL ? <ContactForm /> : null}
            {env.CONTACT_WHATSAPP ? (
              <div className="grid gap-3">
                {env.CONTACT_EMAIL ? <p className="text-sm font-semibold">{t("orWhatsapp")}</p> : null}
                <WhatsAppLink phone={env.CONTACT_WHATSAPP} label={t("whatsapp")} />
              </div>
            ) : null}
          </div>
        ) : null}
      </TicketCard>
    </div>
  );
}
