import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Analytics while it loads: its title, the filters, the numbers, then the four charts. */
export default function AnalyticsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Skeleton className="mb-8 h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <PanelSkeleton key={index} rows={3} />
        ))}
      </div>
    </>
  );
}
