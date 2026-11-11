import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The notifications while they load: the list, then phone alerts beside it. */
export default function NotificationsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={2} />
      </div>
    </>
  );
}
