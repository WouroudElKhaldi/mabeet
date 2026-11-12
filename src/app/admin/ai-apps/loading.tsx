import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The AI usage while it loads. */
export default function AdminAiAppsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PanelSkeleton rows={5} />
    </>
  );
}
