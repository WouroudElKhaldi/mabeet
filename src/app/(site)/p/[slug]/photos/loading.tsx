import { Skeleton } from "@/components/ui/skeleton";

// The shape of the photo tour: a title, then photos two by two.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="mt-2 h-5 w-28" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="aspect-4/3 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
