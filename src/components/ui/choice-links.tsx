import Link from "next/link";
import { choiceChipClass } from "./field";

export interface ChoiceLink {
  href: string;
  label: string;
  /** A second, quieter word in the chip: a price, a count. */
  detail?: string;
  current: boolean;
}

/**
 * One choice among a few, where each choice is its own address (`?plan=PRO`): chips like `ChoiceChips`, but links,
 * so the choice survives a reload and works before the page's JavaScript has loaded.
 */
export function ChoiceLinks({ label, choices }: { label: string; choices: ChoiceLink[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {choices.map((choice) => (
        <Link
          key={choice.href}
          href={choice.href}
          replace
          scroll={false}
          aria-current={choice.current ? "true" : undefined}
          className={`${choiceChipClass} aria-[current=true]:bg-accent-soft aria-[current=true]:ring-accent-line`}
        >
          {choice.label}
          {choice.detail ? (
            <span className="font-normal text-muted tabular-nums">{choice.detail}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
