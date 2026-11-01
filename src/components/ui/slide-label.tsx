import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Add to the button or link that holds a `SlideLabel`: its hover and keyboard focus start the show. */
export const slideParent = "group/slide";

/**
 * A button's label with a bit of fun: on hover (or keyboard focus) the icon hops across to the end and lands with a
 * wiggle, bumping the word off ahead of it. When the pointer leaves, the word springs back.
 * Put it in any `Button`, `ButtonLink` or link with `slideParent`:
 *
 *   <Button className={slideParent}><SlideLabel icon={LogIn}>Sign in</SlideLabel></Button>
 *
 * The motion lives in globals.css (`slide-icon`, `slide-word`). Screen readers hear the plain label. `spinning`
 * turns the icon into a spinner and keeps everything still, for a button that is waiting.
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
  return (
    <span className="relative inline-flex min-w-0 flex-1 items-center justify-center ps-6">
      <Icon
        aria-hidden
        className={clsx(
          "absolute start-0 top-1/2 size-4 -translate-y-1/2",
          spinning ? "animate-spin" : "slide-icon",
          flipInRtl && !spinning && "rtl:rotate-180",
        )}
      />
      <span className={clsx("truncate", !spinning && "slide-word")}>{children}</span>
    </span>
  );
}
