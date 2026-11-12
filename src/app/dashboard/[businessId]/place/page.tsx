import { ExternalLink, Images, Pencil } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { categoryName } from "@/config/appearance";
import { ACCESSIBILITY, TAGS } from "@/config/listing";
import { REGION_KEYS } from "@/config/regions";
import { listCategories } from "@/modules/admin/server";
import { PhotoManager, RoomEditor, SpecialPrices } from "@/modules/rooms";
import { listGallery, listRooms, listSpecialPrices } from "@/modules/rooms/server";
import { PlaceEssentials, type PlaceSection, SettingsForm } from "@/modules/workspaces";
import { getSettings } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { formatMoney } from "@/utils/format";

type PageProps = { params: Promise<{ businessId: string }> };

/** How many photos the photos card shows; the rest are one click away in its pop-up. */
const PHOTOS_SHOWN = 4;

/** A card's summary: each line what is saved now, or a quiet "Not added yet". */
function Facts({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-muted">{row.label}</dt>
          <dd className="mt-0.5 font-semibold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The place itself, apart from its rooms, as one card per part: what guests read, its photos, where it is, what to
 * know and the stay's rules, and the whole place's price when it is booked as a whole. Each card shows what is saved
 * now, and "Edit" opens only that part in a pop-up, so the page stays short and every change is one step.
 */
export default async function PlacePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.place.anyOf);
  const canEditRooms = can(ctx, "rooms.manage");
  const [t, tSettings, tListing, tRegions, locale, settings, rooms, categories, photos] = await Promise.all([
    getTranslations("place"),
    getTranslations("dashboard.settings"),
    getTranslations("listing"),
    getTranslations("regions.names"),
    getLocale(),
    getSettings(ctx),
    listRooms(ctx),
    listCategories("HOME"),
    canEditRooms ? listGallery(ctx, null) : null,
  ]);
  const unit =
    settings.bookingUnit === "WHOLE_PLACE" ? rooms.find((room) => room.kind === "WHOLE_PLACE") : undefined;
  const unitPrices = unit ? await listSpecialPrices(ctx, unit.id) : [];
  const notSet = <span className="font-normal text-muted">{t("notSet")}</span>;
  const list = (values: string[]) => (values.length > 0 ? values.join(", ") : notSet);
  // The region was checked against the list when it was saved; the database only knows it as text.
  const region = REGION_KEYS.find((key) => key === settings.region);
  const chosenCategories = categories.filter((category) => settings.categories.includes(category.slug));

  /** The "Edit" button of one part, opening that part's fields in a pop-up. */
  const edit = (title: string, form: ReactNode, size: "md" | "lg" = "md") => (
    <FormDialog
      label={t("edit")}
      title={title}
      icon={<Pencil className="size-4" aria-hidden />}
      variant="secondary"
      size={size}
    >
      {form}
    </FormDialog>
  );
  const section = (part: PlaceSection) => (
    <SettingsForm
      businessId={businessId}
      part={part}
      settings={settings}
      categories={categories}
      isOwner={ctx.isOwner}
    />
  );

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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Panel
          title={t("aboutTitle")}
          action={edit(
            t("aboutTitle"),
            <PlaceEssentials
              businessId={businessId}
              description={settings.description}
              bookingUnit={settings.bookingUnit}
              canChooseUnit={canEditRooms}
            />,
            "lg",
          )}
        >
          <Facts
            rows={[
              {
                label: t("description"),
                value: settings.description ? (
                  <span className="line-clamp-3 font-normal whitespace-pre-line">{settings.description}</span>
                ) : (
                  notSet
                ),
              },
              { label: t("howBook"), value: t(`units.${settings.bookingUnit}.title`) },
            ]}
          />
        </Panel>

        {photos ? (
          <div id="photos" className="scroll-mt-24">
            <Panel
              title={t("photosTitle")}
              intro={t("photosCount", { count: photos.length })}
              action={
                <FormDialog
                  label={t("managePhotos")}
                  title={t("photosTitle")}
                  icon={<Images className="size-4" aria-hidden />}
                  variant="secondary"
                  size="lg"
                >
                  <PhotoManager businessId={businessId} photos={photos} />
                </FormDialog>
              }
            >
              {photos.length === 0 ? (
                <p className="text-sm text-muted">{t("noPhotos")}</p>
              ) : (
                <ul className="grid grid-cols-4 gap-2">
                  {photos.slice(0, PHOTOS_SHOWN).map((photo) => (
                    <li
                      key={photo.id}
                      className="relative aspect-square overflow-hidden rounded-lg bg-surface-2"
                    >
                      <Image
                        src={photo.url}
                        alt={photo.alt ?? ""}
                        fill
                        sizes="(min-width: 1024px) 12vw, 22vw"
                        className="object-cover"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        ) : null}

        {unit ? (
          <Panel
            title={t("unitTitle")}
            intro={t("unitIntro")}
            action={edit(
              t("unitTitle"),
              <>
                <RoomEditor businessId={businessId} room={unit} canEdit={canEditRooms} unit />
                <SpecialPrices
                  businessId={businessId}
                  roomId={unit.id}
                  currency={settings.currency}
                  baseRateCents={unit.baseRateCents}
                  runs={unitPrices}
                  canEdit={canEditRooms}
                />
              </>,
              "lg",
            )}
          >
            <Facts
              rows={[
                {
                  label: t("pricePerNight"),
                  value: formatMoney(unit.baseRateCents, settings.currency, locale),
                },
                {
                  label: t("size"),
                  value: t("sizeValue", {
                    guests: unit.capacity,
                    bedrooms: unit.bedrooms,
                    beds: unit.beds,
                    bathrooms: unit.bathrooms,
                  }),
                },
                { label: t("specialPrices"), value: t("specialPricesCount", { count: unitPrices.length }) },
              ]}
            />
          </Panel>
        ) : null}

        <Panel title={tSettings("profile")} action={edit(tSettings("profile"), section("profile"), "lg")}>
          <Facts
            rows={[
              { label: tSettings("name"), value: <bdi>{settings.name}</bdi> },
              {
                label: tSettings("area"),
                value:
                  settings.area || region
                    ? [settings.area, region ? tRegions(region) : null].filter(Boolean).join(" · ")
                    : notSet,
              },
              { label: tSettings("address"), value: settings.address ?? notSet },
              {
                label: tSettings("categories"),
                value: list(chosenCategories.map((category) => categoryName(category, locale))),
              },
            ]}
          />
        </Panel>

        <Panel
          title={tSettings("thingsToKnow")}
          action={edit(tSettings("thingsToKnow"), section("thingsToKnow"), "lg")}
        >
          <Facts
            rows={[
              {
                label: tSettings("tags"),
                value: list(
                  TAGS.filter((tag) => settings.tags.includes(tag)).map((tag) => tListing(`tags.${tag}`)),
                ),
              },
              {
                label: tSettings("accessibility"),
                value: list(
                  ACCESSIBILITY.filter((key) => settings.accessibility.includes(key)).map((key) =>
                    tListing(`accessibility.${key}`),
                  ),
                ),
              },
              {
                label: tSettings("minGuestAge"),
                value: settings.minGuestAge !== null ? settings.minGuestAge : notSet,
              },
            ]}
          />
        </Panel>

        <Panel title={tSettings("location")} action={edit(tSettings("location"), section("location"))}>
          <Facts
            rows={[
              {
                label: t("mapPin"),
                value:
                  settings.latitude !== null && settings.longitude !== null ? (
                    <bdi dir="ltr" className="tabular-nums">
                      {settings.latitude}, {settings.longitude}
                    </bdi>
                  ) : (
                    notSet
                  ),
              },
            ]}
          />
        </Panel>

        <Panel
          title={tSettings("stayRules")}
          action={edit(tSettings("stayRules"), section("stayRules"), "lg")}
        >
          <Facts
            rows={[
              {
                label: t("checkInOut"),
                value: (
                  <bdi dir="ltr" className="tabular-nums">
                    {settings.checkInTime} – {settings.checkOutTime}
                  </bdi>
                ),
              },
              {
                label: tSettings("houseRules"),
                value: settings.houseRules ? (
                  <span className="line-clamp-3 font-normal whitespace-pre-line">{settings.houseRules}</span>
                ) : (
                  notSet
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
