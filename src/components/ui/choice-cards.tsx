import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export interface CardChoice<Value extends string> {
  value: Value;
  title: string;
  /** What choosing it means, in a sentence. */
  body: string;
  icon?: LucideIcon;
}

/**
 * One choice among a few that each need a sentence of explanation, as large cards: how guests book and pay, room by
 * room or the whole place. Radio buttons underneath, so the keyboard and screen readers work.
 */
export function ChoiceCards<Value extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
  disabled = false,
  columns = 2,
}: {
  legend: string;
  name: string;
  choices: CardChoice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
  columns?: 2 | 3;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-2 disabled:opacity-60">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className={clsx("grid gap-3", columns === 3 ? "md:grid-cols-3" : "sm:grid-cols-2")}>
        {choices.map(({ value: choice, title, body, icon: Icon }) => (
          <label
            key={choice}
            className={clsx(
              "flex cursor-pointer gap-3 rounded-xl p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ink",
              value === choice ? "bg-accent-soft ring-2 ring-accent" : "ring-1 ring-line hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
              className="sr-only"
            />
            {Icon ? <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden /> : null}
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="mt-0.5 block text-sm text-muted">{body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
