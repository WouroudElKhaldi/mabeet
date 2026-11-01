import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex items-center justify-center font-semibold transition duration-150 ease-(--ease-out) " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "bg-surface text-ink ring-1 ring-ink hover:bg-surface-2",
  ghost: "text-ink underline-offset-4 hover:bg-surface-2",
  danger: "bg-danger text-danger-ink hover:brightness-110",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3.5 text-sm",
  md: "h-11 gap-2 rounded-lg px-5 text-[0.9375rem]",
  lg: "h-12 gap-2 rounded-lg px-6 text-base",
  icon: "size-10 rounded-full",
};

/** The classes of a button, for the rare element that must look like one but cannot be a Button or ButtonLink. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyle & { className?: string } = {}) {
  return clsx(base, variantClasses[variant], sizeClasses[size], className);
}

/** A button. It never submits a form unless the form's own button says `type="submit"`. */
export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

/** A link that looks like a button. */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
