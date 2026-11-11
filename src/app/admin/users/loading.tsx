import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The people list while it loads. */
export default function AdminUsersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PanelSkeleton rows={8} />
    </>
  );
}
