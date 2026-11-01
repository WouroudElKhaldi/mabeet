"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { formFailure } from "@/lib/api-client";

/**
 * Calls the API for a button or a form, then refreshes what the page shows. `pending` stays true until both are done
 * (disable the button, show "Saving…"). After a failure, `error` is the text for `FormError` (what the server said, or
 * a calm fallback), or, when the server named the wrong fields, `fieldErrors` has one entry per field and `error` is
 * null. Choose the text shown under a field by its name, in the visitor's language.
 *
 *   const { run, pending, error, fieldErrors } = useAction();
 *   <Button disabled={pending} onClick={() => run(() => api.post(url, body))}>
 */
export function useAction() {
  const t = useTranslations("common");
  const router = useRouter();
  const [calling, setCalling] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Resolves to `true` when the call worked, so a form can close or move on. */
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    setFieldErrors({});
    setCalling(true);
    try {
      await work();
      startRefresh(() => router.refresh());
      return true;
    } catch (caught) {
      const failure = formFailure(caught, t("error"));
      setError(failure.error);
      setFieldErrors(failure.fieldErrors);
      return false;
    } finally {
      setCalling(false);
    }
  }

  return { run, pending: calling || refreshing, error, fieldErrors };
}
