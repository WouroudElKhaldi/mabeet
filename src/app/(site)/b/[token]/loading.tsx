import { Skeleton } from "@/components/ui/skeleton";

// The shape of the booking page: heading, steps and the next thing to do on the start side, the pass on the end side.
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-280 gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-10">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-3/4 max-w-lg" />
        <Skeleton className="h-5 w-1/2 max-w-sm" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
