import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Add to the button or link that holds a `SlideLabel`: its hover and keyboard focus start the slide. */
export const slideParent = "group/slide";

/**
 * A button's label that steps aside: on hover (or keyboard focus) the words fade away and the icon travels from the
 * start to the end, like walking through a door. Put it in any `Button`, `ButtonLink` or link with `slideParent`:
 *
 *   <Button className={slideParent}><SlideLabel icon={LogIn}>Sign in</SlideLabel></Button>
 *
 * In a full-width button the icon crosses the whole button. Right to left, it travels the other way. `spinning`
 * turns the icon into a spinner that stays put, for a button that is waiting.
 */
export function SlideLabel({
  icon: Icon,
  children,
  flipInRtl = false,
  spinning = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  /** For arrows, which must point the other way in Arabic. */
  flipInRtl?: boolean;
  spinning?: boolean;
}) {
  const moving =
    "group-hover/slide:start-[calc(100%-1rem)] group-focus-visible/slide:start-[calc(100%-1rem)]";
  return (
    <span className="relative inline-flex min-w-0 flex-1 items-center justify-center ps-6">
      <Icon
        aria-hidden
        className={clsx(
          "absolute start-0 top-1/2 size-4 -translate-y-1/2 transition-[inset-inline-start] duration-500 ease-(--ease-spring)",
          flipInRtl && !spinning && "rtl:rotate-180",
          spinning ? "animate-spin" : moving,
        )}
      />
      <span
        className={clsx(
          "truncate transition-[opacity,translate] duration-300 ease-(--ease-out)",
          !spinning &&
            "group-hover/slide:translate-x-3 group-hover/slide:opacity-0 group-focus-visible/slide:translate-x-3 group-focus-visible/slide:opacity-0 rtl:group-hover/slide:-translate-x-3 rtl:group-focus-visible/slide:-translate-x-3",
        )}
      >
        {children}
      </span>
    </span>
  );
}
