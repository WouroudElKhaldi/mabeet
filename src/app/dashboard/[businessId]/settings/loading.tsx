import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The Settings page while it loads: its title and the two parts of the form. */
export default function SettingsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
