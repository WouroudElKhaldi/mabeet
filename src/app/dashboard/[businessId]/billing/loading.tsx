import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The billing page while it loads: its title, what the place uses, and the three plans. */
export default function BillingLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <PanelSkeleton key={index} rows={6} />
          ))}
        </div>
      </div>
    </>
  );
}
