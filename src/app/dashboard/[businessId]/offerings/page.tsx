import { CalendarPlus, Compass, Images, Pencil } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Pill } from "@/components/ui/pill";
import { listCategories } from "@/modules/admin/server";
import { countTakenSeats } from "@/modules/bookings/server";
import { OfferingEditor, SessionScheduler } from "@/modules/offerings";
import { listOfferings } from "@/modules/offerings/server";
import { PhotoManager } from "@/modules/rooms";
import { getPlaceBasics } from "@/modules/workspaces/server";
import { requirePageAccess } from "@/server/http/session";
import { formatMoney } from "@/utils/format";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The place's experiences and services as a table: each with its price, its upcoming dates and whether guests can
 * book it. Editing one, its photos, scheduling its dates (with the seats taken in each) and adding a new one open in
 * pop-ups, so the list stays a list. Who booked which seats is on the Bookings page.
 */
export default async function OfferingsPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.offerings.anyOf);
  const [t, locale, offerings, place, experiences, services] = await Promise.all([
    getTranslations("dashboard.offerings"),
    getLocale(),
    listOfferings(ctx),
    getPlaceBasics(ctx),
    listCategories("EXPERIENCE"),
    listCategories("SERVICE"),
  ]);
  const categories = { EXPERIENCE: experiences, SERVICE: services };
  const taken = await countTakenSeats(
    offerings.flatMap((offering) => offering.sessions.map((session) => session.id)),
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <FormDialog label={t("new")} title={t("new")} size="lg">
            <OfferingEditor businessId={businessId} categories={categories} />
          </FormDialog>
        }
      />
      {offerings.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
      ) : (
        <DataTable
          label={t("title")}
          columns={[
            { label: t("titleLabel") },
            { label: t("price"), align: "end", wide: true },
            { label: t("upcoming"), wide: true },
            { label: t("status") },
            { label: t("actions"), align: "end", hiddenLabel: true },
          ]}
        >
          {offerings.map((offering) => {
            const cover = offering.photos[0];
            const price = formatMoney(offering.priceCents, place.currency, locale);
            return (
              <DataRow key={offering.id}>
                <DataCell>
                  <div className="flex items-center gap-3">
                    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                      {cover ? (
                        <Image src={cover.url} alt="" fill sizes="48px" className="object-cover" />
                      ) : (
                        <Compass className="size-5 text-muted" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        <bdi>{offering.title}</bdi>
                      </span>
                      <span className="block text-muted">
                        {t(`kinds.${offering.kind === "SERVICE" ? "SERVICE" : "EXPERIENCE"}`)}
                        <span className="md:hidden"> · {price}</span>
                      </span>
                    </span>
                  </div>
                </DataCell>
                <DataCell align="end" wide className="tabular-nums">
                  {price}
                </DataCell>
                <DataCell wide className="text-muted">
                  {t("sessionCount", { count: offering.sessions.length })}
                </DataCell>
                <DataCell>
                  <Pill tone={offering.active ? "accent" : "quiet"}>
                    {offering.active ? t("live") : t("hidden")}
                  </Pill>
                </DataCell>
                <DataCell align="end">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <FormDialog
                      label={t("edit")}
                      title={offering.title}
                      icon={<Pencil className="size-4" aria-hidden />}
                      variant="secondary"
                      size="lg"
                    >
                      <OfferingEditor businessId={businessId} offering={offering} categories={categories} />
                    </FormDialog>
                    <FormDialog
                      label={t("photosCount", { count: offering.photos.length })}
                      title={offering.title}
                      icon={<Images className="size-4" aria-hidden />}
                      variant="ghost"
                      size="lg"
                    >
                      <PhotoManager
                        businessId={businessId}
                        offeringId={offering.id}
                        photos={offering.photos}
                      />
                    </FormDialog>
                    <FormDialog
                      label={t("schedule")}
                      title={offering.title}
                      icon={<CalendarPlus className="size-4" aria-hidden />}
                      variant="ghost"
                      size="lg"
                    >
                      <SessionScheduler
                        businessId={businessId}
                        offeringId={offering.id}
                        defaultCapacity={offering.maxGuests}
                        timezone={place.timezone}
                        sessions={offering.sessions.map((session) => ({
                          id: session.id,
                          startsAt: session.startsAt.toISOString(),
                          capacity: session.capacity,
                          seatsTaken: taken.get(session.id) ?? 0,
                        }))}
                      />
                    </FormDialog>
                    {offering.active ? (
                      <ArrowLink href={`/o/${offering.slug}`}>
                        {t("openPage")}
                        <span className="sr-only"> {offering.title}</span>
                      </ArrowLink>
                    ) : null}
                  </div>
                </DataCell>
              </DataRow>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
