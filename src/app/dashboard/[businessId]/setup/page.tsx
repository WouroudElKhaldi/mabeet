import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { FormDialog } from "@/components/ui/form-dialog";
import { StepFlow } from "@/components/ui/step-flow";
import { SETUP_PHOTOS, SETUP_SCREENS, type SetupScreen } from "@/config/setup";
import { listCategories } from "@/modules/admin/server";
import { PhotoManager, RoomEditor, SetupChecklist } from "@/modules/rooms";
import { getSetupChecklist, listGallery, listRooms } from "@/modules/rooms/server";
import { PlaceEssentials, SettingsForm, setupQuery } from "@/modules/workspaces";
import { getSettings } from "@/modules/workspaces/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { formatMoney } from "@/utils/format";

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The screens that are a form: their own button saves and moves on. The others save as they go. */
const FORM_SCREENS: readonly SetupScreen[] = ["unit", "profile", "describe", "booking", "contact"];

/**
 * The guided setup after adding a place: one question a screen (how guests book, where it is, its description, its
 * photos, what guests book, how they pay, how they reach it), each its own address (`?step=`), with a progress bar,
 * Back, "Skip for now" and "Save and exit". It ends on the setup checklist, where the place is published. Every
 * answer is saved through the same forms as the place's own pages, so leaving halfway loses nothing.
 */
export default async function SetupPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.place.anyOf);
  const { step: screen } = setupQuery.parse(await searchParams);
  const canEditRooms = can(ctx, "rooms.manage");
  const [t, tRooms, locale, settings] = await Promise.all([
    getTranslations("setup"),
    getTranslations("dashboard.rooms"),
    getLocale(),
    getSettings(ctx),
  ]);

  const index = SETUP_SCREENS.indexOf(screen);
  const base = `/dashboard/${businessId}`;
  const href = (target: SetupScreen) => `${base}/setup?step=${target}`;
  const next = SETUP_SCREENS[index + 1];
  const previous = SETUP_SCREENS[index - 1];

  return (
    <StepFlow
      progressLabel={t("progress")}
      stepLabel={t("flow.stepOf", { current: index + 1, total: SETUP_SCREENS.length })}
      step={index + 1}
      total={SETUP_SCREENS.length}
      title={t(`flow.screens.${screen}.title`)}
      intro={t(`flow.screens.${screen}.intro`)}
      saves={FORM_SCREENS.includes(screen)}
      continueLabel={t("flow.continue")}
      nextLabel={next ? (FORM_SCREENS.includes(screen) ? t("flow.skip") : t("flow.next")) : t("flow.finish")}
      nextHref={next ? href(next) : base}
      backLabel={t("flow.back")}
      backHref={previous ? href(previous) : null}
      exitLabel={t("flow.saveAndExit")}
      exitHref={base}
    >
      {await screenContent(screen)}
    </StepFlow>
  );

  /** The one question of this screen, through the form the place's own pages use for it. */
  async function screenContent(current: SetupScreen) {
    switch (current) {
      case "unit":
      case "describe":
        return (
          <PlaceEssentials
            businessId={businessId}
            description={settings.description}
            bookingUnit={settings.bookingUnit}
            canChooseUnit={canEditRooms}
            ask={current === "unit" ? "unit" : "description"}
          />
        );
      case "profile":
        return (
          <SettingsForm
            businessId={businessId}
            part="profile"
            settings={settings}
            categories={await listCategories("HOME")}
            isOwner={ctx.isOwner}
          />
        );
      case "photos": {
        if (!canEditRooms) return <p className="text-sm text-muted">{t("flow.notYours")}</p>;
        const photos = await listGallery(ctx, null);
        return (
          <div className="grid gap-4">
            <p className="text-sm font-semibold">
              {t("steps.photos.body", { count: photos.length, needed: SETUP_PHOTOS })}
            </p>
            <PhotoManager businessId={businessId} photos={photos} />
          </div>
        );
      }
      case "rooms":
        return roomsContent();
      case "booking":
      case "contact":
        return (
          <SettingsForm
            businessId={businessId}
            part={current === "booking" ? "payments" : "contact"}
            settings={settings}
            isOwner={ctx.isOwner}
          />
        );
      case "publish": {
        const setup = await getSetupChecklist(ctx);
        return (
          <SetupChecklist
            businessId={businessId}
            steps={setup.steps}
            photoCount={setup.photoCount}
            ready={setup.ready}
            inSetup
          />
        );
      }
    }
  }

  /** What guests book: the whole-place unit and its price, or the rooms, each added in a pop-up. */
  async function roomsContent() {
    if (!canEditRooms) return <p className="text-sm text-muted">{t("flow.notYours")}</p>;
    const all = await listRooms(ctx);
    if (settings.bookingUnit === "WHOLE_PLACE") {
      const unit = all.find((room) => room.kind === "WHOLE_PLACE");
      return unit ? <RoomEditor businessId={businessId} room={unit} canEdit unit /> : null;
    }
    const rooms = all.filter((room) => room.kind === "ROOM");
    return (
      <div className="grid gap-4">
        {rooms.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{tRooms("empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-line"
              >
                <span className="min-w-0">
                  <bdi className="block font-semibold">{room.name}</bdi>
                  <span className="text-sm text-muted">
                    {tRooms("sizeValue", { guests: room.capacity, beds: room.beds })}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(room.baseRateCents, settings.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div>
          <FormDialog label={tRooms("new")} title={tRooms("new")} size="lg">
            <RoomEditor businessId={businessId} canEdit wholePlace={false} />
          </FormDialog>
        </div>
      </div>
    );
  }
}
