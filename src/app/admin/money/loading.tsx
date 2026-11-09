import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The money page while it loads: the revenue tiles, then the payouts, balances, refunds and months. */
export default function AdminMoneyLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
