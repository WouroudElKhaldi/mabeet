import { getTranslations } from "next-intl/server";
import { HeroLandscape } from "@/components/site/hero-landscape";
import { Wordmark } from "@/components/site/wordmark";
import { ButtonLink } from "@/components/ui/button";

/** A page that does not exist: Mount Lebanon at dusk, a big 404 and the way home. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      <HeroLandscape />
      <div className="absolute start-6 top-6">
        <Wordmark />
      </div>
      <div className="relative">
        <p className="rise-in font-display text-[clamp(5rem,18vw,11rem)] leading-none font-bold tracking-tighter text-accent">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("notFoundBody")}</p>
        <ButtonLink href="/" className="mt-8">
          {t("home")}
        </ButtonLink>
      </div>
    </main>
  );
}
