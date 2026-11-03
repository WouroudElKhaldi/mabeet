import { Skeleton } from "@/components/ui/skeleton";

// The shape of the trips page: the greeting, then trip cards.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-36 rounded-full" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
      <div className="mt-10 flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
