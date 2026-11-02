import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The small tinted pill above a big public title, with an icon: what the page is about, in a few words. */
export function Eyebrow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="rise-in inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
      <Icon className="size-4" aria-hidden />
      {children}
    </p>
  );
}
