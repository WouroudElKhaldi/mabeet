import { PageHeaderSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** A money list while it loads: the header, the tabs, the filters and the table's rows. */
export function MoneyListLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4">
        <Skeleton className="h-9 w-full max-w-xl rounded-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </>
  );
}
