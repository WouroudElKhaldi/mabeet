import type { ReactNode } from "react";
import { HeroLandscape } from "./hero-landscape";

/**
 * The closing call of a public page: Mount Lebanon at dusk (`HeroLandscape`) across a wide rounded band, with a big
 * title, one line and the actions centred above the ridges.
 */
export function LandscapeBand({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-surface-2 px-6 pt-16 pb-48 text-center ring-1 ring-line sm:pb-56">
      <HeroLandscape />
      <div className="relative mx-auto max-w-2xl">
        <h2 className="font-poster text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-extrabold">{title}</h2>
        {intro ? <p className="mx-auto mt-4 max-w-lg text-lg text-muted">{intro}</p> : null}
        {children ? <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div> : null}
      </div>
    </section>
  );
}
