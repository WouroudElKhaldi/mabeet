import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The host profile while it loads: its form. */
export default function HostProfileLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="max-w-3xl">
        <PanelSkeleton rows={6} />
      </div>
    </>
  );
}
