import { BadgePercent } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ArchWindow } from "@/components/brand/arch-window";
import { Postmark } from "@/components/brand/postmark";
import { BrandScene, SceneLayer } from "@/components/brand/brand-scene";
import { stagger } from "@/utils/motion";

/**
 * The poster hero, with the triple-arch window beside it. The listings that fill the arches and the sample boarding
 * pass, the search bar, browsing and the story of booking direct come with the public pages (the directory).
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto grid max-w-360 items-center gap-12 px-4 pt-10 pb-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10 lg:pt-14">
      <div className="min-w-0">
        <p className="rise-in inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
          <BadgePercent className="size-4" aria-hidden />
          {t("eyebrow")}
        </p>
        <h1
          className="rise-in mt-5 max-w-2xl font-poster text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[0.98] font-extrabold [font-stretch:118%] rtl:[font-stretch:100%]"
          style={stagger(1)}
        >
          {t.rich("title", { em: (chunk) => <em>{chunk}</em> })}
        </h1>
        <p className="rise-in mt-5 max-w-xl text-lg leading-relaxed text-muted" style={stagger(2)}>
          {t("subtitle")}
        </p>
      </div>

      {/* The window leans with the mouse, its hills slide by depth, and the postmark is stamped in front. */}
      <BrandScene className="mx-auto hidden w-full max-w-xl pb-16 lg:block">
        <SceneLayer enter="rise">
          <ArchWindow photos={[]} seed="hero" priority className="ms-auto w-[78%]" />
        </SceneLayer>
        <SceneLayer depth={90} enter="stamp" className="absolute end-0 -top-8 size-28">
          <Postmark className="size-full rotate-12" spin />
        </SceneLayer>
      </BrandScene>
    </section>
  );
}
