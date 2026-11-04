"use client";

import { clsx } from "clsx";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { GuestCounter } from "@/components/ui/guest-counter";
import { MAX_STAY_NIGHTS } from "@/config/booking-limits";
import { type SearchLink, searchHref } from "@/lib/search-url";

/** The most guests a search asks for, as the search's address allows. */
const MAX_GUESTS = 30;

/** Towns guests often look for. The value stays in English (it matches listings); the label is translated. */
const POPULAR_AREAS = [
  "Batroun",
  "Byblos",
  "Chouf",
  "Ehden",
  "Tannourine",
  "Jezzine",
  "Douma",
  "Tyre",
] as const;

type Panel = "where" | "who" | null;

/**
 * The pill search: where, when, who, and a round search button. It keeps the rest of the search (categories,
 * filters) and starts it again from these three. The town suggestions and the guests open under the bar; the dates
 * open the calendar dialog. Every part works from the keyboard, and Escape closes what is open.
 */
export function SearchBar({ search = {} }: { search?: SearchLink }) {
  const t = useTranslations("search");
  const router = useRouter();
  const root = useRef<HTMLFormElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [area, setArea] = useState(search.area ?? "");
  const [dates, setDates] = useState<DateRangeValue>({
    checkIn: search.checkIn ?? null,
    checkOut: search.checkOut ?? null,
  });
  const [guests, setGuests] = useState(search.guests ?? 2);

  useEffect(() => {
    if (!panel) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      const away =
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node);
      if (away) setPanel(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [panel]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const complete = dates.checkIn !== null && dates.checkOut !== null;
    setPanel(null);
    router.push(
      searchHref({
        ...search,
        area: area.trim() || undefined,
        checkIn: complete ? (dates.checkIn ?? undefined) : undefined,
        checkOut: complete ? (dates.checkOut ?? undefined) : undefined,
        guests,
      }),
    );
  };

  // The bar lays itself out by its own width, not the screen's: in the home hero's column on a laptop it has a phone's
  // room, and stacks like on a phone.
  return (
    <div className="@container w-full max-w-[52rem]">
      <form
        ref={root}
        onSubmit={submit}
        role="search"
        className={clsx(
          "relative grid w-full grid-cols-1 rounded-3xl ring-1 ring-line-strong @lg:grid-cols-[1.1fr_1.5fr_1fr] @lg:rounded-full",
          panel ? "bg-surface-2" : "bg-surface shadow-lift",
        )}
      >
        <label
          className={clsx(
            "flex min-w-0 cursor-text flex-col justify-center rounded-full px-6 py-3 transition-colors",
            panel === "where" ? "bg-surface shadow-lift" : "hover:bg-surface-2",
          )}
        >
          <span className="text-xs font-bold">{t("where")}</span>
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            onFocus={() => setPanel("where")}
            placeholder={t("wherePlaceholder")}
            maxLength={60}
            className="w-full truncate bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>

        <div className="border-line @max-lg:border-y @lg:border-x">
          <DateRangePicker value={dates} onChange={setDates} maxNights={MAX_STAY_NIGHTS} look="bare" />
        </div>

        <div
          className={clsx(
            "flex items-center gap-2 rounded-full pe-2",
            panel === "who" ? "bg-surface shadow-lift" : "hover:bg-surface-2",
          )}
        >
          <button
            type="button"
            aria-expanded={panel === "who"}
            onClick={() => setPanel(panel === "who" ? null : "who")}
            className="flex min-w-0 flex-1 flex-col justify-center rounded-full px-6 py-3 text-start"
          >
            <span className="text-xs font-bold">{t("who")}</span>
            <span className="truncate text-sm">{t("guests", { count: guests })}</span>
          </button>
          <button
            type="submit"
            aria-label={t("submit")}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-strong active:scale-95"
          >
            <Search className="size-[1.125rem]" strokeWidth={2.75} aria-hidden />
          </button>
        </div>

        <AnimatePresence>
          {panel && (
            <motion.div
              key={panel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-30 rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line @lg:p-8"
            >
              {panel === "where" ? (
                <div>
                  <p className="mb-4 text-sm font-semibold">{t("popular")}</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_AREAS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setArea(name);
                          setPanel(null);
                        }}
                        className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line-strong transition-colors hover:ring-ink"
                      >
                        {t(`areas.${name}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <GuestCounter value={guests} onChange={setGuests} max={MAX_GUESTS} hint={t("guestsHint")} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
