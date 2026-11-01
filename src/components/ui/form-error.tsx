import { clsx } from "clsx";

/** The one way to show a failed action or form: announced to screen readers, nothing rendered when there's no error. */
export function FormError({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className={clsx("text-sm font-semibold text-danger", className)}>
      {message}
    </p>
  );
}
