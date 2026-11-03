import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Today while it loads: its title, the four numbers, then the requests and the charts. */
export default function TodayLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
