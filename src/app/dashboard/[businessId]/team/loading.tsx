import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The Team page while it loads: its title, the members, the invitation form, the invitations and the roles. */
export default function TeamLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-10">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={2} />
        <div className="grid gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}
