"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGED_EVENT = "mabeet-choice-changed";

// When the browser blocks storage (private browsing), a choice still lasts until the page closes.
const keptInMemory = new Map<string, string>();

function read(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey) ?? keptInMemory.get(storageKey) ?? null;
  } catch {
    return keptInMemory.get(storageKey) ?? null;
  }
}

function write(storageKey: string, value: string) {
  keptInMemory.set(storageKey, value);
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Kept in memory above.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED_EVENT, onChange);
  };
}

/** A saved value is used only if it is still one of the allowed choices (an old or edited value never breaks a page). */
export function pickChoice<T extends string>(saved: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === saved) ?? fallback;
}

/**
 * Remembers a choice in this browser, such as the calendar view:
 *
 *   const [view, setView] = useStoredChoice("calendar-view", ["month", "week"] as const, "month");
 *
 * The first paint (and the server) use `fallback`; the saved choice replaces it as soon as the page is in the browser.
 */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const storageKey = `mabeet-choice:${key}`;
  const saved = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null,
  );
  const choose = useCallback((next: T) => write(storageKey, next), [storageKey]);
  return [pickChoice(saved, allowed, fallback), choose] as const;
}
