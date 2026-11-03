import clsx from "clsx";
import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * A titled part of a public page: the section title size from the design system, an optional line, the content.
 * `id` names the section so `OnThisPage` (or any link) can jump to it; the jump stops below the sticky header.
 */
export function Section({
  id,
  title,
  intro,
  className,
  style,
  children,
}: {
  id?: string;
  title: string;
  intro?: string;
  className?: string;
  /** For a `rise-in` section's place in the sequence (`stagger`). */
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const generatedId = useId();
  const titleId = id ? `${id}-title` : generatedId;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={clsx("min-w-0 scroll-mt-28", className)}
      style={style}
    >
      <h2 id={titleId} className="text-[1.375rem] font-semibold">
        {title}
      </h2>
      {intro ? <p className="mt-2 max-w-2xl leading-relaxed text-muted">{intro}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
