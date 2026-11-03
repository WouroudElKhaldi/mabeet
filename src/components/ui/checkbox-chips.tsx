import { choiceChipClass } from "./field";

/**
 * Several choices among many, as a row of chips that fill when ticked: tags, accessibility, categories. Plain
 * checkboxes underneath, sent with the form under `name`.
 */
export function CheckboxChips({
  legend,
  hint,
  name,
  options,
  selected,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: readonly string[];
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      {hint ? <p className="mb-2 text-xs text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className={choiceChipClass}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
