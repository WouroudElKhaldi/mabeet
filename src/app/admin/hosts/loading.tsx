import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The hosts while they load: one card per host with their businesses. */
export default function AdminHostsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={1} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
