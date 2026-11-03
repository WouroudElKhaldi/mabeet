import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The keys page while it loads: its title, the new-key form, the keys and what the AI looked at. */
export default function KeysLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-10">
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}
