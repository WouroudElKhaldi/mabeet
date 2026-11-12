import { BedDouble, Images, Pencil } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Pill } from "@/components/ui/pill";
import { PhotoManager, RoomEditor, SpecialPrices } from "@/modules/rooms";
import { listGallery, listRooms, listSpecialPrices } from "@/modules/rooms/server";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { formatMoney } from "@/utils/format";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The place's rooms as a table: each with its first photo, size, price and whether guests can book it. Editing a
 * room (with its special prices), its photos, and adding a new one each open in a pop-up, so the list stays a list.
 * The whole-place unit lives on the "Your place" page.
 */
export default async function RoomsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.rooms.anyOf);
  const canEdit = can(ctx, "rooms.manage");
  const [t, locale, all, place] = await Promise.all([
    getTranslations("dashboard.rooms"),
    getLocale(),
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
      <PageHeader
        title={t("title")}
        intro={t("count", { count: rooms.length })}
        actions={
          canEdit ? (
            <FormDialog label={t("new")} title={t("new")} size="lg">
              <RoomEditor businessId={businessId} canEdit wholePlace={wholePlace} />
            </FormDialog>
          ) : null
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {wholePlace && (
          <p className="rounded-xl bg-accent-soft p-4 text-sm ring-1 ring-accent-line">
            {t("wholePlaceNote")}{" "}
            <ArrowLink href={`/dashboard/${businessId}/place`}>{t("wholePlaceLink")}</ArrowLink>
          </p>
        )}
        {rooms.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
        ) : (
          <DataTable
            label={t("title")}
            columns={[
              { label: t("room") },
              { label: t("size"), wide: true },
              { label: t("rate"), align: "end", wide: true },
              { label: t("status") },
              { label: t("actions"), align: "end", hiddenLabel: true },
            ]}
          >
            {rooms.map((room, index) => {
              const photos = galleries?.[index] ?? [];
              const cover = photos[0];
              return (
                <DataRow key={room.id}>
                  <DataCell>
                    <div className="flex items-center gap-3">
                      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                        {cover ? (
                          <Image src={cover.url} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          <BedDouble className="size-5 text-muted" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          <bdi>{room.name}</bdi>
                        </span>
                        <span className="block text-muted md:hidden">
                          {formatMoney(room.baseRateCents, place.currency, locale)}
                        </span>
                      </span>
                    </div>
                  </DataCell>
                  <DataCell wide className="text-muted">
                    {t("sizeValue", { guests: room.capacity, beds: room.beds })}
                  </DataCell>
                  <DataCell align="end" wide className="tabular-nums">
                    {formatMoney(room.baseRateCents, place.currency, locale)}
                  </DataCell>
                  <DataCell>
                    <Pill tone={room.active ? "accent" : "quiet"}>
                      {room.active ? (wholePlace ? t("shown") : t("live")) : t("hidden")}
                    </Pill>
                  </DataCell>
                  <DataCell align="end">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <FormDialog
                        label={canEdit ? t("edit") : t("view")}
                        title={room.name}
                        icon={<Pencil className="size-4" aria-hidden />}
                        variant="secondary"
                        size="lg"
                      >
                        <RoomEditor
                          businessId={businessId}
                          room={room}
                          canEdit={canEdit}
                          wholePlace={wholePlace}
                        />
                        <SpecialPrices
                          businessId={businessId}
                          roomId={room.id}
                          currency={place.currency}
                          baseRateCents={room.baseRateCents}
                          runs={prices[index] ?? []}
                          canEdit={canEdit}
                        />
                      </FormDialog>
                      {galleries ? (
                        <FormDialog
                          label={t("photosCount", { count: photos.length })}
                          title={t("photos")}
                          icon={<Images className="size-4" aria-hidden />}
                          variant="ghost"
                          size="lg"
                        >
                          <PhotoManager businessId={businessId} roomId={room.id} photos={photos} />
                        </FormDialog>
                      ) : null}
                    </div>
                  </DataCell>
                </DataRow>
              );
            })}
          </DataTable>
        )}
      </div>
    </>
  );
}
