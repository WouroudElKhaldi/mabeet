import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The categories while they load: one list per kind. */
export default function AdminCategoriesLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={2} />
      </div>
    </>
  );
}
