import type { ReactNode } from "react";
import { HeroLandscape } from "@/components/site/hero-landscape";
import { Wordmark } from "@/components/site/wordmark";
import { stagger } from "@/utils/motion";

/**
 * A whole page that says one thing and offers a way on: page not found, something went wrong, you're offline.
 * Mount Lebanon at dusk fills the screen, the wordmark sits in the corner, and `mark` (the big "404", or an icon)
 * stands above the title in the accent. It has no site header, so it also works when the layout itself failed.
 */
export function MessagePage({
  mark,
  title,
  body,
  footnote,
  children,
}: {
  mark?: ReactNode;
  title: string;
  body: string;
  /** Small print under the actions, such as the reference of an error to quote when writing to us. */
  footnote?: string;
  children?: ReactNode;
}) {
  return (
    <main
      id="main"
      className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-24 text-center"
    >
      <HeroLandscape />
      <div className="absolute start-6 top-6">
        <Wordmark />
      </div>
      <div className="relative max-w-xl">
        {mark ? (
          <div className="rise-in flex justify-center font-display text-[clamp(5rem,18vw,11rem)] leading-none font-bold tracking-tighter text-accent">
            {mark}
          </div>
        ) : null}
        <h1 className="rise-in mt-4 text-3xl font-semibold text-balance" style={stagger(1)}>
          {title}
        </h1>
        <p className="rise-in mx-auto mt-3 max-w-md text-muted" style={stagger(2)}>
          {body}
        </p>
        {children ? (
          <div className="rise-in mt-8 flex flex-wrap justify-center gap-3" style={stagger(3)}>
            {children}
          </div>
        ) : null}
        {footnote ? (
          <p className="rise-in mt-6 text-xs text-faint tabular-nums" style={stagger(4)}>
            {footnote}
          </p>
        ) : null}
      </div>
    </main>
  );
}
