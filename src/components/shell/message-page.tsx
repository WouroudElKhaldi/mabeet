import type { ReactNode } from "react";

/** A plain page that says one thing and offers a way on: "page not found", "something went wrong". */
export function MessagePage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
      <span aria-hidden className="block h-1 w-10 rounded-full bg-glow" />
      <h1 className="font-poster text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold">{title}</h1>
      <p className="text-muted">{body}</p>
      {children ? <div className="mt-2 flex flex-wrap gap-3">{children}</div> : null}
    </main>
  );
}
