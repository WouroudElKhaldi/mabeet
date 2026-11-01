import clsx from "clsx";

/** A grey shape that shimmers while the real content loads. Give it the size of what it stands for. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton", className)} />;
}
