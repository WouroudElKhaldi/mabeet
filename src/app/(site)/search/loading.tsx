import { Skeleton } from "@/components/ui/skeleton";

const CARDS = 12;

// The shape of the search page: the search bar, the row of categories, then the grid of places.
export default function Loading() {
  return (
    <div className="mx-auto max-w-360 px-4 pt-6 sm:px-6 lg:px-10">
      <Skeleton className="h-36 w-full rounded-2xl lg:h-18" />
      <div className="mt-6 flex gap-8 overflow-hidden border-b border-line pb-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-16 shrink-0" />
        ))}
      </div>
      <Skeleton className="mt-8 h-5 w-40" />
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: CARDS }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="mt-2.5 h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
