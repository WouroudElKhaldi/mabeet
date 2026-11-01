import { Skeleton } from "../ui/skeleton";
import { panelClass } from "../ui/field";

// The shapes of the common page parts, for a `loading.tsx` that looks like the page it stands in for (same columns,
// same card sizes). Add one here when a new kind of page part needs it, and use these before drawing your own.

/** The title block of `PageHeader`. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="mb-3 h-1 w-10" />
      <Skeleton className="h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
    </div>
  );
}

/** A `Panel`: its title, then `rows` lines of content. */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={panelClass}>
      <Skeleton className="mb-5 h-6 w-1/3" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/** A grid of cards, each a photo above two lines: places, rooms, photos. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
