import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The calendar links page while it loads: its title, then a panel per room. */
export default function ChannelsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
