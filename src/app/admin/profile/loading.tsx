import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The admin's profile while it loads: the details and the password. */
export default function AdminProfileLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid max-w-3xl gap-6">
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={2} />
      </div>
    </>
  );
}
