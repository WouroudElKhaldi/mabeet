import type { LucideIcon } from "lucide-react";
import { stagger } from "@/utils/motion";

export interface IconPoint {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * Reasons or features, each an accent icon over a short title and a line, two to a row from `sm`. They rise in one
 * after another, starting at `firstStagger` so they follow whatever rose before them.
 */
export function IconPoints({ points, firstStagger = 0 }: { points: IconPoint[]; firstStagger?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {points.map(({ icon: Icon, title, body }, index) => (
        <li key={title} className="rise-in" style={stagger(firstStagger + index)}>
          <Icon className="size-6 text-accent" aria-hidden strokeWidth={1.6} />
          <p className="mt-3 font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
        </li>
      ))}
    </ul>
  );
}
