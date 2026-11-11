import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The sync health while it loads. */
export default function AdminHealthLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PanelSkeleton rows={4} />
    </>
  );
}
