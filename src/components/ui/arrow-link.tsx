import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

/** An underlined text link that leads on to another page, with an arrow that points the reading way. */
export function ArrowLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={clsx(
        "inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4",
        className,
      )}
      {...props}
    >
      {children}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
