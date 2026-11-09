import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The Payouts page while it loads: its title, the three balances, the request form, the payouts and the payments. */
export default function PayoutsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-10">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
