import { AtSign, Bot, CalendarSync, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlanPicker } from "@/components/billing/plan-picker";
import { TicketCard } from "@/components/brand/ticket-card";
import { HeroHeading } from "@/components/site/hero-heading";
import { IconPoints } from "@/components/site/icon-points";
import { ButtonLink } from "@/components/ui/button";
import { StepTrail } from "@/components/ui/step-trail";
import type { PlanName } from "@/config/plans";
import { paidPlan } from "@/modules/billing";
import { planPaymentMethods } from "@/modules/billing/server";
import { CreateWorkspaceForm } from "@/modules/workspaces";
import { getCurrentUser } from "@/server/http/session";
import { signInUrl, signUpUrl } from "@/utils/sign-in-url";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host");
  return { title: t("title"), description: t("intro") };
}

/** Each plan is its own address, so picking one keeps it through a reload, sign-up and sign-in. */
const hostUrl = (plan: PlanName) => (plan === "FREE" ? "/host" : `/host?plan=${plan}`);

/**
 * Become a host: why, then the ticket that creates the workspace. The plan comes from /pricing as `?plan=` and can
 * be changed right here; with a paid plan the form goes on to pay for it. Signed out, the plan rides along through
 * sign-up or sign-in and back here.
 */
export default async function HostPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [t, user, query] = await Promise.all([getTranslations("host"), getCurrentUser(), searchParams]);
  const chosen = paidPlan.safeParse(query.plan);
  const plan = chosen.success ? chosen.data : undefined;
  const methods = planPaymentMethods();
  const paying = plan !== undefined && Object.values(methods).some(Boolean);
  const steps = paying
    ? [t("steps.place"), t("steps.pay"), t("steps.rooms")]
    : [t("steps.place"), t("steps.rooms")];

  return (
    <div className="mx-auto grid max-w-360 gap-16 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <section className="min-w-0">
        <HeroHeading title={t.rich("headline", { em: (chunk) => <em>{chunk}</em> })} intro={t("intro")} />
        <div className="mt-10">
          <IconPoints
            firstStagger={2}
            points={[
              { icon: CalendarSync, title: t("points.sync.title"), body: t("points.sync.body") },
              { icon: ShieldCheck, title: t("points.noDouble.title"), body: t("points.noDouble.body") },
              { icon: AtSign, title: t("points.instagram.title"), body: t("points.instagram.body") },
              { icon: Bot, title: t("points.ai.title"), body: t("points.ai.body") },
            ]}
          />
        </div>
      </section>
      <TicketCard
        sticky
        title={t("formTitle")}
        intro={plan ? (paying ? t("paidSubtitle") : t("payingOff")) : t("formSubtitle")}
        header={<StepTrail label={t("steps.label")} steps={steps} current={0} />}
        stub={<PlanPicker current={plan ?? "FREE"} hrefFor={hostUrl} />}
      >
        {user ? (
          <CreateWorkspaceForm plan={paying ? plan : undefined} methods={methods} />
        ) : (
          <div className="grid gap-3">
            <ButtonLink href={signUpUrl(hostUrl(plan ?? "FREE"))} size="lg">
              {t("signUpFirst")}
            </ButtonLink>
            <ButtonLink href={signInUrl(hostUrl(plan ?? "FREE"))} variant="secondary">
              {t("haveAccount")}
            </ButtonLink>
          </div>
        )}
      </TicketCard>
    </div>
  );
}
