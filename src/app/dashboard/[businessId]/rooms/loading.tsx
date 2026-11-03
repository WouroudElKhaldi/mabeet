import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The Rooms page while it loads: its title, a few closed rooms and the form to add one. */
export default function RoomsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
