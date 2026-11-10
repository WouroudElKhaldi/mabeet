import { Skeleton } from "@/components/ui/skeleton";

// The shape of the saved places: the account's own heading, then a grid of cards.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 sm:px-6 lg:px-10">
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="mt-8 h-9 w-full max-w-md" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="grid gap-2.5">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
