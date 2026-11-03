import { PageHeaderSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The calendar while it loads: its title, the month grid, and the day panel beside it. */
export default function CalendarLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[34rem] w-full rounded-xl" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
