import { Skeleton } from "@/components/ui/skeleton";

// The shape of the book page: the form on the start side, the boarding pass on the end side.
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
