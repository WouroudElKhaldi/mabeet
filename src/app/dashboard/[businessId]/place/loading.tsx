import { CardGridSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** "Your place" while it loads: its title, the description and how guests book, the photos, and the place's details. */
export default function PlaceLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton rows={4} />
        <CardGridSkeleton count={5} />
        <PanelSkeleton rows={6} />
      </div>
    </>
  );
}
