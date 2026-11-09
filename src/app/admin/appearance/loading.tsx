import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The palette picker while it loads. */
export default function AdminAppearanceLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PanelSkeleton rows={2} />
    </>
  );
}
