import { Skeleton } from "@/components/ui/skeleton";

// The shape of the timeline: the account's own heading, then a list of lines.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-10 sm:px-6 lg:px-10">
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="mt-8 h-9 w-full max-w-md" />
      <div className="mt-10 grid max-w-3xl gap-3">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
