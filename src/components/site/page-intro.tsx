import type { ReactNode } from "react";

/** The centred title block of a public page that is not a hero: a poster title and one line under it. */
export function PageIntro({ title, intro }: { title: ReactNode; intro?: string }) {
  return (
    <header className="rise-in mx-auto mb-10 max-w-2xl text-center">
      <h1 className="font-poster text-[clamp(2rem,4vw,3rem)]">{title}</h1>
      {intro ? <p className="mt-3 text-lg text-muted">{intro}</p> : null}
    </header>
  );
}

/** A quiet centred line at the end of a public page: the small print that applies to everything above it. */
export function PageNote({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-center text-sm text-muted">{children}</p>;
}
