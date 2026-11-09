import { Skeleton } from "@/components/ui/skeleton";

// The shape of the Contact host page: the title and the usual questions beside the message ticket.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-2/3 max-w-sm" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-6 w-56" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <Skeleton className="h-120 w-full rounded-2xl" />
      </div>
    </div>
  );
}
