import type { LucideIcon } from "lucide-react";
import { choiceChipClass } from "./field";

export interface Choice<Value extends string> {
  value: Value;
  label: string;
  icon?: LucideIcon;
}

/** One choice among a few, as a row of chips (radio buttons underneath, so the keyboard and screen readers work). */
export function ChoiceChips<Value extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  name: string;
  choices: Choice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5 disabled:opacity-40">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map(({ value: choice, label, icon: Icon }) => (
          <label key={choice} className={choiceChipClass}>
            <input
              type="radio"
              name={name}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
              className="sr-only"
            />
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
