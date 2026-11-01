/** A calm message for a whole form. It renders nothing when there is no message. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/30">
      {message}
    </p>
  );
}
