import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The money overview while it loads: the tabs, the tiles, then plan revenue by month. */
export default function AdminMoneyLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <Skeleton className="h-9 w-full max-w-xl rounded-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
