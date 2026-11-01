import clsx from "clsx";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

// Inputs and text areas share these classes. They are built from one base and never overridden (we have no class
// merging tool), so a text area is not "an input with a different height".
const controlBase =
  "w-full rounded-lg bg-surface text-[0.9375rem] text-ink ring-1 ring-line-strong outline-none " +
  "placeholder:text-faint focus:ring-2 focus:ring-ink aria-invalid:ring-danger disabled:opacity-40";

/** For selects and custom inputs that must look like a `Field`'s input. */
export const inputClass = `${controlBase} h-12 px-4`;

const textAreaClass = `${controlBase} min-h-28 px-4 py-3`;

/** A small caption over a compact input, for inline forms (prices, sessions). */
export const labelledControlClass = "flex flex-col gap-1 text-xs font-semibold text-muted";

/** A raised card. */
export const panelClass = "rounded-xl bg-surface p-5 ring-1 ring-line";

/** A pill around a hidden checkbox or radio (`sr-only`); it fills with the accent's tint when checked. */
export const choiceChipClass =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold " +
  "text-ink ring-1 ring-line-strong transition has-checked:bg-accent-soft has-checked:ring-accent-line " +
  "has-focus-visible:ring-2 has-focus-visible:ring-ink";

const labelClass = "text-sm font-semibold text-ink";

interface FieldText {
  label: string;
  /** A short help text under the control. */
  hint?: string;
  /** What is wrong, in words the person understands. It replaces the hint. */
  error?: string | null;
}

// Emails, phone numbers and web addresses are always written left to right, even on an Arabic page. Without this,
// "+961 70 123 456" shows as "961 70 123 456+" and "name@mail.com" as "mail.com@name".
export function inputDirection(type: string | undefined) {
  return type === "email" || type === "tel" || type === "url" ? "ltr" : undefined;
}

function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string | null }) {
  if (error) {
    return (
      <p id={id} className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="text-sm text-muted">
        {hint}
      </p>
    );
  }
  return null;
}

// What a screen reader needs to link a control to its message and to know it is wrong.
function controlAccessibility(id: string, hint?: string, error?: string | null) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? `${id}-message` : undefined,
  } as const;
}

/** A label, an input, and a hint or an error under it. Use it for every text input. */
export function Field({ label, hint, error, id, className, ...props }: ComponentProps<"input"> & FieldText) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className={labelClass}>
        {label}
      </label>
      <input
        id={controlId}
        className={clsx(inputClass, className)}
        dir={inputDirection(props.type)}
        {...controlAccessibility(controlId, hint, error)}
        {...props}
      />
      <FieldMessage id={`${controlId}-message`} hint={hint} error={error} />
    </div>
  );
}

/** The same as `Field`, for long text. */
export function TextArea({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: ComponentProps<"textarea"> & FieldText) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className={labelClass}>
        {label}
      </label>
      <textarea
        id={controlId}
        className={clsx(textAreaClass, className)}
        {...controlAccessibility(controlId, hint, error)}
        {...props}
      />
      <FieldMessage id={`${controlId}-message`} hint={hint} error={error} />
    </div>
  );
}

/** A label around any control: a select, a date, a group of checkboxes. */
export function LabeledControl({
  label,
  hint,
  error,
  className,
  children,
}: FieldText & { className?: string; children: ReactNode }) {
  const messageId = useId();
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>{label}</span>
        {children}
      </label>
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
