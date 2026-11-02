import {
  BadgePercent,
  CalendarCheck,
  CalendarSync,
  Flag,
  Handshake,
  HeartHandshake,
  HousePlus,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Route,
  SlidersHorizontal,
  Smartphone,
  TrendingDown,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArchWindow } from "@/components/brand/arch-window";
import { BrandScene, SceneLayer } from "@/components/brand/brand-scene";
import { Postmark } from "@/components/brand/postmark";
import { Receipt } from "@/components/brand/receipt-card";
import { BigStat } from "@/components/site/big-stat";
import { Eyebrow } from "@/components/site/eyebrow";
import { HeroHeading } from "@/components/site/hero-heading";
import { Journey } from "@/components/site/journey";
import { LandscapeBand } from "@/components/site/landscape-band";
import { Section } from "@/components/site/section";
import { StatBand } from "@/components/site/stat-band";
import { StoryChapter } from "@/components/site/story-chapter";
import { StoryRail } from "@/components/site/story-rail";
import { TopicCard } from "@/components/site/topic-card";
import { ArrowLink } from "@/components/ui/arrow-link";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { stagger } from "@/utils/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("intro") };
}

// What a platform's commission costs a host, from the estimate in docs/scope-lock.md (section 4): up to 18% (the
// usual cut is 15 to 18%) of a room at about $80 a night, over 20 nights a month.
const COMMISSION_PERCENT = 18;
const NIGHT_PRICE_CENTS = 8_000;
const NIGHTS_A_MONTH = 20;
const LOST_PER_NIGHT_CENTS = (NIGHT_PRICE_CENTS * COMMISSION_PERCENT) / 100;

/**
 * About Mabeet (approved by Sami, 2026-11-02): the story of booking direct, told with the brand art. The opening is
 * a 3D scene (the arch window, a receipt of our promises, the postmark); then what platforms take, counted up; how a
 * booking travels; the three booking modes and our promises as tilting cards; and Mount Lebanon to close. One
 * journey line (`StoryRail`) runs through every chapter, filling as the visitor scrolls, with the Mabeet mark travelling
 * along it.
 */
export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <div className="overflow-x-clip">
      <section className="mx-auto grid max-w-360 items-center gap-14 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10 lg:pt-14">
        <div className="min-w-0">
          <Eyebrow icon={MapPin}>{t("eyebrow")}</Eyebrow>
          <div className="mt-5">
            <HeroHeading title={t.rich("headline", { em: (chunk) => <em>{chunk}</em> })} intro={t("intro")} />
          </div>
          <div className="rise-in mt-8 flex flex-wrap gap-3" style={stagger(3)}>
            <ButtonLink href="/search" size="lg" className={slideParent}>
              <SlideLabel icon={Search}>{t("explore")}</SlideLabel>
            </ButtonLink>
            <ButtonLink href="/host" size="lg" variant="secondary" className={slideParent}>
              <SlideLabel icon={HousePlus}>{t("host")}</SlideLabel>
            </ButtonLink>
          </div>
        </div>
        {/* The window leans with the mouse; the receipt floats in front of it (from `sm`: on a phone it would cover the
            text, and the promises come again below) and the postmark is stamped on top. */}
        <BrandScene className="relative mx-auto w-full max-w-xl pb-10">
          <SceneLayer enter="rise">
            <ArchWindow photos={[]} seed="about" priority className="ms-auto w-[82%]" />
          </SceneLayer>
          <SceneLayer
            depth={80}
            enter="drop"
            className="absolute start-0 bottom-0 hidden w-[62%] max-w-72 sm:block"
          >
            <Receipt
              title={t("glance.title")}
              lines={[t("glance.commission"), t("glance.refunds"), t("glance.double"), t("glance.direct")]}
              footer={t("glance.footer")}
            />
          </SceneLayer>
          <SceneLayer depth={120} enter="stamp" className="absolute end-0 -top-6 size-24 sm:size-28">
            <Postmark className="size-full rotate-12" spin />
          </SceneLayer>
        </BrandScene>
      </section>

      <div className="mx-auto max-w-360 px-4 pt-20 sm:px-6 lg:px-10">
        <StoryRail>
          <StoryChapter number={1} kicker={t("chapters.problem")} icon={TrendingDown}>
            <StatBand title={t("problem.title")} intro={t("problem.intro")} note={t("problem.note")}>
              <BigStat
                value={<CountUp to={COMMISSION_PERCENT} format="percent" />}
                label={t("problem.commission")}
                style={stagger(2)}
              />
              <BigStat
                value={<CountUp to={LOST_PER_NIGHT_CENTS} format="usdCents" />}
                label={t("problem.night")}
                style={stagger(3)}
              />
              <BigStat
                value={<CountUp to={LOST_PER_NIGHT_CENTS * NIGHTS_A_MONTH} format="usdCents" />}
                label={t("problem.month")}
                style={stagger(4)}
              />
            </StatBand>
          </StoryChapter>

          <StoryChapter number={2} kicker={t("chapters.how")} icon={Route}>
            <Section title={t("how.title")} intro={t("how.intro")}>
              <div className="mt-6">
                <Journey
                  stops={[
                    { icon: HousePlus, title: t("how.add.title"), body: t("how.add.body") },
                    { icon: CalendarSync, title: t("how.pick.title"), body: t("how.pick.body") },
                    { icon: Smartphone, title: t("how.pay.title"), body: t("how.pay.body") },
                    { icon: CalendarCheck, title: t("how.confirm.title"), body: t("how.confirm.body") },
                  ]}
                />
              </div>
            </Section>
          </StoryChapter>

          <StoryChapter number={3} kicker={t("chapters.modes")} icon={SlidersHorizontal}>
            <Section title={t("modes.title")} intro={t("modes.intro")}>
              <div className="grid gap-4 md:grid-cols-3">
                <TopicCard
                  number={1}
                  icon={Zap}
                  title={t("modes.automatic.title")}
                  body={t("modes.automatic.body")}
                  style={stagger(1)}
                />
                <TopicCard
                  number={2}
                  icon={UserRoundCheck}
                  title={t("modes.approval.title")}
                  body={t("modes.approval.body")}
                  style={stagger(2)}
                />
                <TopicCard
                  number={3}
                  icon={Handshake}
                  title={t("modes.offline.title")}
                  body={t("modes.offline.body")}
                  style={stagger(3)}
                />
              </div>
            </Section>
          </StoryChapter>

          <StoryChapter number={4} kicker={t("chapters.promises")} icon={HeartHandshake}>
            <Section title={t("promises.title")}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <TopicCard
                  number={1}
                  icon={ShieldCheck}
                  title={t("promises.double.title")}
                  body={t("promises.double.body")}
                  highlight
                  style={stagger(1)}
                />
                <TopicCard
                  number={2}
                  icon={RotateCcw}
                  title={t("promises.refunds.title")}
                  body={t("promises.refunds.body")}
                  style={stagger(2)}
                />
                <TopicCard
                  number={3}
                  icon={BadgePercent}
                  title={t("promises.commission.title")}
                  body={t("promises.commission.body")}
                  action={<ArrowLink href="/pricing">{t("promises.seePlans")}</ArrowLink>}
                  style={stagger(3)}
                />
                <TopicCard
                  number={4}
                  icon={UserRoundCheck}
                  title={t("promises.data.title")}
                  body={t("promises.data.body")}
                  action={<ArrowLink href="/privacy">{t("promises.readPrivacy")}</ArrowLink>}
                  style={stagger(4)}
                />
              </div>
            </Section>
          </StoryChapter>

          <StoryChapter number={5} kicker={t("chapters.arrive")} icon={Flag}>
            <LandscapeBand
              title={t.rich("band.title", { em: (chunk) => <em>{chunk}</em> })}
              intro={t("band.intro")}
            >
              <ButtonLink href="/search" size="lg" className={slideParent}>
                <SlideLabel icon={Search}>{t("explore")}</SlideLabel>
              </ButtonLink>
              <ButtonLink href="/host" size="lg" variant="secondary" className={slideParent}>
                <SlideLabel icon={HousePlus}>{t("host")}</SlideLabel>
              </ButtonLink>
            </LandscapeBand>
          </StoryChapter>
        </StoryRail>
      </div>
    </div>
  );
}
