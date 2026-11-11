import { PageHeaderSkeleton, PanelSkeleton } from "@/components/shell/skeletons";

/** The partners while they load: one closed panel each. */
export default function AdminPartnersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PanelSkeleton rows={4} />
    </>
  );
}
