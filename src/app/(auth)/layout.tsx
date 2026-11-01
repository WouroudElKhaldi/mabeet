import { BadgePercent, CalendarCheck, HandCoins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ArchWindow } from "@/components/brand/arch-window";
import { BoardingPass } from "@/components/brand/boarding-pass";
import { Postmark } from "@/components/brand/postmark";
import { BrandScene, SceneLayer, Sheen } from "@/components/brand/brand-scene";
import { BackLink } from "@/components/shell/back-link";
import { Wordmark } from "@/components/site/wordmark";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { stagger } from "@/utils/motion";

/**
 * Form on one side; on the other, the brand: the triple-arch window and a boarding pass. The window shows generated
 * art until the public pages (the directory) can fill it with real places' photos.
 *
 * On a laptop the page is exactly the window's height and never scrolls: on a short window (`short:`) the spacing
 * tightens, and the back link and the three reasons step aside (the wordmark and the brand panel say the same). Only
 * on a window shorter still does the form's own column scroll.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth.panel");
  const trust = [
    { icon: BadgePercent, text: t("trust1") },
    { icon: HandCoins, text: t("trust2") },
    { icon: CalendarCheck, text: t("trust3") },
  ];

  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-12 lg:overflow-y-auto short:py-4">
        <div className="flex items-center justify-between">
          <Wordmark />
          <AppearanceMenu />
        </div>
        <main id="main" className="m-auto w-full max-w-sm py-12 lg:py-8 short:py-3">
          <BackLink className="mb-6 short:hidden" />
          {children}
        </main>
        <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted short:hidden">
          {trust.map(({ icon: Icon, text }, index) => (
            <li key={text} className="rise-in inline-flex items-center gap-1.5" style={stagger(index + 6)}>
              <Icon className="size-3.5 text-accent" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <aside className="relative hidden overflow-hidden bg-accent px-12 pt-14 pb-12 text-accent-ink lg:flex lg:flex-col short:pt-10 short:pb-8">
        {/* The postmark is stamped onto the panel when the page opens, in the corner where it always sits. */}
        <SceneLayer enter="stamp" className="absolute end-10 top-10 size-28">
          <Postmark className="size-full -rotate-12 text-accent-ink opacity-90" spin />
        </SceneLayer>
        <p className="rise-in text-sm font-bold tracking-[0.16em] uppercase opacity-80">{t("kicker")}</p>
        <h2 className="rise-in mt-4 max-w-md font-poster text-[clamp(2rem,2.8vw,2.75rem)]" style={stagger(1)}>
          {t("title")}
        </h2>
        <p className="rise-in mt-4 max-w-sm text-lg leading-relaxed opacity-85" style={stagger(2)}>
          {t("body")}
        </p>

        {/* A small 3D scene: the window at the back, the pass floating in front of it. */}
        <BrandScene className="mt-auto pt-10">
          <SceneLayer enter="rise" className="flex items-end">
            <ArchWindow photos={[]} seed="auth" className="w-[66%] [&>div]:ring-accent-ink/90" />
          </SceneLayer>
          <SceneLayer
            depth={90}
            enter="drop"
            className="absolute end-0 bottom-[42%] w-[40%] max-w-72 short:bottom-[30%]"
          >
            <div className="float relative rotate-3 rounded-2xl text-ink">
              <BoardingPass
                biteColor="var(--accent)"
                kicker={t("passKicker")}
                title={t("passTitle")}
                subtitle={t("passSubtitle")}
                fields={[
                  { label: t("fees"), value: t("feesValue") },
                  { label: t("payment"), value: t("paymentValue") },
                  { label: t("hold"), value: t("holdValue") },
                  { label: t("language"), value: t("languageValue") },
                ]}
              />
              <Sheen />
            </div>
          </SceneLayer>
        </BrandScene>
      </aside>
    </div>
  );
}
