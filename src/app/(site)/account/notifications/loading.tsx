import { Skeleton } from "@/components/ui/skeleton";

// The shape of the notifications page: the greeting and tabs, then the switch for this device.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-36 rounded-full" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-8 h-10 w-72" />
      <Skeleton className="mt-10 h-44 w-full max-w-3xl rounded-2xl" />
    </div>
  );
}
