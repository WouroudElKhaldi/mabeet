import { Search, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TicketCard } from "@/components/brand/ticket-card";
import { ExamplePrompt } from "@/components/site/example-prompt";
import { HeroHeading } from "@/components/site/hero-heading";
import { IconPoints } from "@/components/site/icon-points";
import { Section } from "@/components/site/section";
import { ButtonLink } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { CopyField } from "@/components/ui/copy-field";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { StepList } from "@/components/ui/step-list";
import { env } from "@/server/env";
import { stagger } from "@/utils/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("useWithAi");
  return { title: t("title"), description: t("intro") };
}

const CONNECT_STEPS = ["open", "add", "paste"] as const;

/**
 * Use Mabeet from your AI app (F6): what MCP is, why a guest would use it, the guest MCP address to copy, how to
 * connect Claude or ChatGPT, and what it can and cannot do. No sign-in and no chat on this page: the AI is the
 * visitor's own app.
 */
export default async function UseWithAiPage() {
  const t = await getTranslations("useWithAi");
  const address = new URL("/api/mcp/guest", env.BETTER_AUTH_URL).toString();

  return (
    <div className="mx-auto max-w-360 px-4 pt-10 pb-8 sm:px-6 lg:px-10">
      <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0">
          <HeroHeading title={t.rich("headline", { em: (chunk) => <em>{chunk}</em> })} intro={t("intro")} />
          <Section
            title={t("whatTitle")}
            intro={t("whatBody")}
            className="rise-in mt-12"
            style={stagger(2)}
          />
          <div className="mt-10">
            <IconPoints
              firstStagger={3}
              points={[
                { icon: Sparkles, title: t("why.app.title"), body: t("why.app.body") },
                { icon: Search, title: t("why.live.title"), body: t("why.live.body") },
                { icon: Ticket, title: t("why.book.title"), body: t("why.book.body") },
              ]}
            />
          </div>
        </div>
        <TicketCard
          sticky
          title={t("connectTitle")}
          intro={t("connectIntro")}
          stub={<CopyField value={address} label={t("address")} />}
        >
          <div className="grid gap-6">
            <StepList
              title={t("claude.title")}
              steps={CONNECT_STEPS.map((step) => t(`claude.steps.${step}`))}
            />
            <StepList
              title={t("chatgpt.title")}
              steps={CONNECT_STEPS.map((step) => t(`chatgpt.steps.${step}`))}
            />
            <ExamplePrompt label={t("tryLabel")} prompt={t("example")} />
          </div>
        </TicketCard>
      </div>
      <Section title={t("limitsTitle")} intro={t("limitsIntro")} className="mt-16 border-t border-line pt-12">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden strokeWidth={1.6} />
            <CheckList
              missingLabel={t("cannotLabel")}
              items={[
                { text: t("can.search"), included: true },
                { text: t("can.dates"), included: true },
                { text: t("can.link"), included: true },
                { text: t("cannot.book"), included: false },
                { text: t("cannot.account"), included: false },
              ]}
            />
          </div>
          <ButtonLink href="/search" className={slideParent}>
            <SlideLabel icon={Search}>{t("browse")}</SlideLabel>
          </ButtonLink>
        </div>
      </Section>
    </div>
  );
}
