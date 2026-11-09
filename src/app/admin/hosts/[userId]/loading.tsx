import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** One host while it loads: their profile, then their businesses. */
export default function AdminHostLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={2} />
      </div>
    </>
  );
}
