import { PageHeaderSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The Experiences & services page while it loads: its title and a few rows of the table. */
export default function OfferingsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </>
  );
}
