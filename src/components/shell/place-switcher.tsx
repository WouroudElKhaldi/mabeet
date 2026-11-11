"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { NewPlaceForm } from "@/modules/workspaces";
import { SheetDialog } from "../ui/sheet-dialog";
import { NAV_ICONS } from "./nav-icons";

export interface SwitcherPlace {
  id: string;
  name: string;
}

const rowClass =
  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2";

/**
 * The place being managed, at the top of the menu, and the way to every other place this person works in: one click
 * away on every dashboard page, not only on "All my places". It is the browser's own <details>, so it opens with the
 * keyboard; following a link folds it again, since the menu stays on screen while the page changes. "Add a place"
 * opens a pop-up right here, never the sign-up page for new hosts. The pop-up sits outside the <details>, whose
 * content the browser hides once it folds.
 */
export function PlaceSwitcher({
  current,
  places,
  onNavigate,
}: {
  current: SwitcherPlace;
  /** Every place this person works in, the current one among them. */
  places: SwitcherPlace[];
  /** Called when a link is followed, so the phone drawer can close itself. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("shell");
  const panel = useRef<HTMLDetailsElement>(null);
  const others = places.filter((place) => place.id !== current.id);
  const PlaceIcon = NAV_ICONS.place;
  const AllIcon = NAV_ICONS.overview;
  const [adding, setAdding] = useState(false);
  const follow = () => {
    if (panel.current) panel.current.open = false;
    onNavigate?.();
  };
  const startAdding = () => {
    if (panel.current) panel.current.open = false;
    setAdding(true);
  };

  return (
    <>
      <details
        ref={panel}
        className="group rounded-xl bg-surface-2 ring-1 ring-line open:bg-surface open:shadow-soft"
      >
        <summary
          aria-label={t("switchPlace", { name: current.name })}
          className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-ink">
            {[...current.name][0]?.toUpperCase() ?? ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">
              {t("currentPlace")}
            </span>
            <span className="block truncate text-[0.9375rem] font-semibold">{current.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
        </summary>
        <div className="grid gap-1 border-t border-line p-1.5">
          {others.length > 0 ? (
            <ul aria-label={t("otherPlaces")} className="grid gap-1">
              {others.map((place) => (
                <li key={place.id}>
                  <Link href={`/dashboard/${place.id}`} onClick={follow} className={rowClass}>
                    <PlaceIcon className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="truncate">{place.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {others.length > 0 ? (
            <Link href="/dashboard" onClick={follow} className={rowClass}>
              <AllIcon className="size-4 shrink-0 text-muted" aria-hidden />
              {t("allPlaces")}
            </Link>
          ) : null}
          <button type="button" onClick={startAdding} className={`${rowClass} w-full text-start`}>
            <Plus className="size-4 shrink-0 text-muted" aria-hidden />
            {t("addPlace")}
          </button>
        </div>
      </details>
      <SheetDialog open={adding} onClose={() => setAdding(false)} title={t("addPlace")} compact>
        {adding ? <NewPlaceForm /> : null}
      </SheetDialog>
    </>
  );
}
