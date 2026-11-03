import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** "All my places" while it loads: its title, today's totals, then a card per place. */
export default function AllMyPlacesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="mt-8">
        <CardGridSkeleton count={4} />
      </div>
    </div>
  );
}
