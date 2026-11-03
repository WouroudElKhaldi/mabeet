import type { ReactNode } from "react";
import { stagger } from "@/utils/motion";

/**
 * The big opening of a public page that sells something: a wide poster title (an `<em>` in it takes the accent)
 * and a short line under it, rising in one after the other.
 */
export function HeroHeading({ title, intro }: { title: ReactNode; intro?: string }) {
  return (
    <>
      <h1 className="rise-in max-w-2xl font-poster text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] font-extrabold [font-stretch:118%] rtl:[font-stretch:100%]">
        {title}
      </h1>
      {intro ? (
        <p className="rise-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={stagger(1)}>
          {intro}
        </p>
      ) : null}
    </>
  );
}
