"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { formFailure, isAborted } from "@/lib/api-client";

/**
 * Lets one run happen at a time. `start()` says no (`null`) while a run is going, so a double click, or Enter pressed
 * twice, can never save, book or pay twice. Call the function it returns when the run ends.
 */
export function createSingleFlight() {
  let running = false;
  let runs = 0;
  return {
    start(): (() => void) | null {
      if (running) return null;
      running = true;
      const mine = ++runs;
      // Only the run that started it can end it: a late, repeated "done" from an earlier run must not unlock a later one.
      return () => {
        if (runs === mine) running = false;
      };
    },
  };
}

/**
 * Calls the API for a button or a form, then refreshes what the page shows. `pending` stays true until both are done
 * (disable the button, show "Saving…"). After a failure, `error` is the text for `FormError` (what the server said, or
 * a calm fallback). A form that shows a message under its fields names them (`shownFields`): when the server named
 * only those, `fieldErrors` has one entry per field and `error` is null. Choose the text shown under a field by its
 * name, in the visitor's language. A second call while one is running is ignored (it resolves to `false` and changes
 * nothing).
 *
 *   const { run, pending, error, fieldErrors } = useAction(["name", "phone"]);
 *   <Button disabled={pending} onClick={() => run(() => api.post(url, body))}>
 */
export function useAction(shownFields: readonly string[] = []) {
  const t = useTranslations("common");
  const router = useRouter();
  const [calling, setCalling] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [singleFlight] = useState(createSingleFlight);

  /** Resolves to `true` when the call worked, so a form can close or move on. */
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    const end = singleFlight.start();
    if (!end) return false;
    setError(null);
    setFieldErrors({});
    setCalling(true);
    try {
      await work();
      startRefresh(() => router.refresh());
      return true;
    } catch (caught) {
      // A call we cancelled ourselves is not a failure to show.
      if (isAborted(caught)) return false;
      const failure = formFailure(caught, t("error"), shownFields);
      setError(failure.error);
      setFieldErrors(failure.fieldErrors);
      return false;
    } finally {
      setCalling(false);
      end();
    }
  }

  return { run, pending: calling || refreshing, error, fieldErrors };
}
