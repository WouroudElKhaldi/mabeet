import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The offers while they load: the new-offer form, then the list. */
export default function AdminOffersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-8">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={3} />
      </div>
    </>
  );
}
