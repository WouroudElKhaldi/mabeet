import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { panelClass } from "@/components/ui/field";
import { listCategories } from "@/modules/admin/server";
import { PhotoManager, RoomEditor, SpecialPrices } from "@/modules/rooms";
import { listGallery, listRooms, listSpecialPrices } from "@/modules/rooms/server";
import { PlaceEssentials, SettingsForm } from "@/modules/workspaces";
import { getSettings } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The place itself, apart from its rooms: what guests read, how they book it (room by room or as a whole, with the
 * whole-place unit's price and size), the photos of the whole place, and what guests see about it.
 */
export default async function PlacePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.place.anyOf);
  const canEditRooms = can(ctx, "rooms.manage");
  const [t, settings, rooms, categories, photos] = await Promise.all([
    getTranslations("place"),
    getSettings(ctx),
    listRooms(ctx),
    listCategories("HOME"),
    canEditRooms ? listGallery(ctx, null) : null,
  ]);
  const unit =
    settings.bookingUnit === "WHOLE_PLACE" ? rooms.find((room) => room.kind === "WHOLE_PLACE") : undefined;
  const unitPrices = unit ? await listSpecialPrices(ctx, unit.id) : [];

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <ButtonLink href={`/p/${settings.slug}`} variant="secondary" size="sm">
            <ExternalLink className="size-4" aria-hidden />
            {t("viewPage")}
          </ButtonLink>
        }
      />
      <div className="grid gap-6">
        <PlaceEssentials
          businessId={businessId}
          description={settings.description}
          bookingUnit={settings.bookingUnit}
          canChooseUnit={canEditRooms}
        />
        {unit ? (
          <Panel title={t("unitTitle")} intro={t("unitIntro")}>
            <RoomEditor businessId={businessId} room={unit} canEdit={canEditRooms} unit />
            <SpecialPrices
              businessId={businessId}
              roomId={unit.id}
              currency={settings.currency}
              baseRateCents={unit.baseRateCents}
              runs={unitPrices}
              canEdit={canEditRooms}
            />
          </Panel>
        ) : null}
        {photos ? (
          <div className={panelClass}>
            <PhotoManager businessId={businessId} photos={photos} />
          </div>
        ) : null}
        <SettingsForm
          businessId={businessId}
          part="place"
          settings={settings}
          categories={categories}
          isOwner={ctx.isOwner}
        />
      </div>
    </>
  );
}
