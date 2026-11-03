"use client";

import { clsx } from "clsx";
import { Check, Globe, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { iconMotion, iconMotionParent } from "@/components/ui/icon-motion";
import { LOCALES, MODE_STORAGE_KEY } from "@/config/appearance";
import type { Mode } from "@/config/appearance";

const DARK_DEVICE = "(prefers-color-scheme: dark)";

// The page's mode is the `data-mode` attribute on <html>, set before paint by the boot script. Reading it from there
// (and not from a copy in React state) means the button can never disagree with what the visitor sees.
function readMode(): Mode {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

function savedMode(): string | null {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function watchMode(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  // Until the visitor chooses, the page follows the device when its setting changes (evening dark mode, for example).
  const device = matchMedia(DARK_DEVICE);
  const followDevice = () => {
    if (savedMode() === null) document.documentElement.dataset.mode = device.matches ? "dark" : "light";
  };
  device.addEventListener("change", followDevice);
  // The device may have changed between the boot script and this listener (while the page was loading).
  followDevice();
  return () => {
    observer.disconnect();
    device.removeEventListener("change", followDevice);
  };
}

function chooseMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked (private browsing): the choice then lasts until the page closes, which is fine.
  }
  const apply = () => {
    document.documentElement.dataset.mode = mode;
  };
  // A soft cross-fade between modes where the browser supports it.
  if ("startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // A transition the browser skips (another one started, the tab is hidden) rejects; the mode is applied anyway.
    document.startViewTransition(apply).ready.catch(() => undefined);
  } else {
    apply();
  }
}

/**
 * Two header controls: a one-tap light/dark switch, and a language menu.
 * The colour palette itself is chosen site-wide by the platform admin.
 */
export function AppearanceMenu() {
  return (
    <div className="flex items-center">
      <ModeToggle />
      <LanguageMenu />
    </div>
  );
}

function ModeToggle() {
  const t = useTranslations("appearance");
  const mode = useSyncExternalStore(watchMode, readMode, () => "light" as Mode);
  const next = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => chooseMode(next)}
      aria-label={t(next === "dark" ? "toDark" : "toLight")}
      title={t(next === "dark" ? "toDark" : "toLight")}
      className={clsx(
        "grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2",
        iconMotionParent,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="grid"
        >
          {mode === "dark" ? (
            <Moon className={clsx("size-[1.15rem]", iconMotion.rock)} aria-hidden />
          ) : (
            <Sun className={clsx("size-[1.15rem]", iconMotion.spin)} aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function LanguageMenu() {
  const t = useTranslations("appearance");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !panel.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (code: string) =>
    startTransition(async () => {
      setOpen(false);
      await setLocale(code);
    });

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("language")}
        title={t("language")}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 disabled:opacity-40",
          iconMotionParent,
        )}
      >
        <Globe className={clsx("size-[1.15rem]", iconMotion.turn)} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={t("language")}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-12 z-50 w-44 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
          >
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === code}
                lang={code}
                onClick={() => choose(code)}
                className={clsx(
                  "flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm transition-colors hover:bg-surface-2",
                  locale === code && "font-semibold",
                )}
              >
                {t(`languageNames.${code}`)}
                {locale === code && <Check className="size-4 text-accent" aria-hidden />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
