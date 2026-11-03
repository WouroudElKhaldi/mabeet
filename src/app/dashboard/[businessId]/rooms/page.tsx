import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { DisclosurePanel } from "@/components/shell/disclosure-panel";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { PhotoManager, RoomEditor, SpecialPrices } from "@/modules/rooms";
import { listGallery, listRooms, listSpecialPrices } from "@/modules/rooms/server";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The place's rooms: each one opens to edit it, with its photos and its special prices, and a new one is added at the
 * end. The whole-place unit lives on the "Your place" page.
 */
export default async function RoomsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.rooms.anyOf);
  const canEdit = can(ctx, "rooms.manage");
  const [t, all, place] = await Promise.all([
    getTranslations("dashboard.rooms"),
    listRooms(ctx),
    getPlaceBasics(ctx),
  ]);
  const rooms = all.filter((room) => room.kind === "ROOM");
  const wholePlace = place.bookingUnit === "WHOLE_PLACE";
  const [prices, galleries] = await Promise.all([
    Promise.all(rooms.map((room) => listSpecialPrices(ctx, room.id))),
    canEdit ? Promise.all(rooms.map((room) => listGallery(ctx, room.id))) : null,
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-4">
        {wholePlace && (
          <p className="rounded-xl bg-accent-soft p-4 text-sm ring-1 ring-accent-line">
            {t("wholePlaceNote")}{" "}
            <ArrowLink href={`/dashboard/${businessId}/place`}>{t("wholePlaceLink")}</ArrowLink>
          </p>
        )}
        {rooms.map((room, index) => (
          <DisclosurePanel
            key={room.id}
            title={room.name}
            status={room.active ? (wholePlace ? t("shown") : t("live")) : t("hidden")}
            defaultOpen={rooms.length === 1}
          >
            <RoomEditor businessId={businessId} room={room} canEdit={canEdit} wholePlace={wholePlace} />
            {galleries && (
              <div className="mt-8 border-t border-line pt-6">
                <PhotoManager businessId={businessId} roomId={room.id} photos={galleries[index] ?? []} />
              </div>
            )}
            <SpecialPrices
              businessId={businessId}
              roomId={room.id}
              currency={place.currency}
              baseRateCents={room.baseRateCents}
              runs={prices[index] ?? []}
              canEdit={canEdit}
            />
          </DisclosurePanel>
        ))}
        {canEdit && (
          <Panel title={t("new")}>
            <RoomEditor businessId={businessId} canEdit wholePlace={wholePlace} />
          </Panel>
        )}
      </div>
    </>
  );
}
