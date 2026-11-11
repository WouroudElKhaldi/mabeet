import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** One person while they load: their account, their places, then their stays. */
export default function AdminPersonLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
