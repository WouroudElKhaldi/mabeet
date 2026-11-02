import clsx from "clsx";
import { Check, Minus } from "lucide-react";

export interface CheckListItem {
  text: string;
  included: boolean;
}

/**
 * What something includes, ticked, and what it leaves out, dimmed with a dash. Screen readers hear `missingLabel`
 * before a left-out item, since the dash alone says nothing to them.
 */
export function CheckList({
  items,
  missingLabel,
  className,
}: {
  items: CheckListItem[];
  missingLabel: string;
  className?: string;
}) {
  return (
    <ul className={clsx("grid content-start gap-2.5 text-sm", className)}>
      {items.map((item) => (
        <li key={item.text} className={clsx("flex gap-2", !item.included && "text-faint")}>
          {item.included ? (
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          ) : (
            <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>
            {!item.included && <span className="sr-only">{missingLabel} </span>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
