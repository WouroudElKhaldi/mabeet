import { Skeleton } from "@/components/ui/skeleton";

// The shape of the privacy page: the greeting and tabs, then the download and delete cards.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-36 rounded-full" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-8 h-10 w-56" />
      <div className="mt-10 flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    </div>
  );
}
