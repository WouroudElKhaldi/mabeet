import { PageHeaderSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The Reviews page while it loads: its title, the rating, and a few reviews. */
export default function ReviewsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <Skeleton className="h-7 w-48" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </>
  );
}
