import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The profile while it loads: the details, the host profile and the password. */
export default function ProfileLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid max-w-3xl gap-6">
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={2} />
      </div>
    </>
  );
}
