import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The admin overview while it loads: the four numbers, what needs attention, the newest businesses. */
export default function AdminOverviewLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={6} />
        </div>
      </div>
    </>
  );
}
