"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, MODE_STORAGE_KEY } from "@/config/appearance";
import type { Locale, Mode } from "@/config/appearance";
import { Button } from "../ui/button";

// The page's mode is the `data-mode` attribute on <html>, set before paint by the boot script. Reading it from there
// (and not from a copy in React state) means the button can never disagree with what the visitor sees.
function readMode(): Mode {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

function watchMode(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => observer.disconnect();
}

function chooseMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked (private browsing): the choice then lasts until the page closes, which is fine.
  }
}

const selectClass =
  "h-10 rounded-full bg-surface px-3 text-sm font-semibold text-ink ring-1 ring-line-strong outline-none " +
  "focus:ring-2 focus:ring-ink disabled:opacity-40";

/** The language and the light/dark switch, for the top bar of every page. */
export function AppearanceMenu() {
  const t = useTranslations("appearance");
  const locale = useLocale() as Locale;
  const [pending, startTransition] = useTransition();
  const mode = useSyncExternalStore(watchMode, readMode, () => "light" as Mode);

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={t("language")}
        className={selectClass}
        value={locale}
        disabled={pending}
        onChange={(event) => startTransition(() => setLocale(event.target.value))}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(`languageNames.${option}`)}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon"
        aria-label={mode === "dark" ? t("toLight") : t("toDark")}
        onClick={() => chooseMode(mode === "dark" ? "light" : "dark")}
      >
        {mode === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      </Button>
    </div>
  );
}
