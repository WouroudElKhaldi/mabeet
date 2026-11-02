"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api, errorMessage, isAborted, queryUrl } from "@/lib/api-client";
import type { Query } from "@/lib/api-client";
import { useDebouncedValue } from "./use-debounced-value";

interface Outcome<T> {
  /** The address (with its query) this answer is for. */
  key: string;
  data: T | null;
  /** What went wrong, or null when the call worked. */
  caught: unknown;
}

/**
 * An answer counts only for the question being asked now. A slow answer to an old question (the dates before the
 * ones just picked) must never be shown as the answer to the new one: a price for other nights would be a lie.
 */
export function settledFor<T>(wantedKey: string | null, outcome: Outcome<T> | null): Outcome<T> | null {
  return wantedKey !== null && outcome !== null && outcome.key === wantedKey ? outcome : null;
}

/**
 * Reads from the API and keeps the answer in step with what the screen asks, as the visitor changes it (dates, guests,
 * a search text):
 *
 *   const quote = useLiveQuery<Quote>(ready ? `/api/public/places/${slug}/rooms/${roomId}/quote` : null, { checkIn, checkOut });
 *   quote.loading ? <Skeleton /> : quote.error ? <FormError message={quote.error} /> : <Price quote={quote.data} />
 *
 * - Changes made in quick succession give one call (`delayMs`, 300 by default).
 * - A call that is no longer wanted is cancelled, so the server is not kept busy and an old answer cannot arrive late.
 * - Leaving the page cancels the call.
 * - A call that takes too long ends with `error` (`timeoutMs`, 30 seconds by default), never a spinner for ever.
 * - `url` null means "do not ask yet" (the dates are not both picked): `loading` is false and `data` is null.
 * - `data` is null while the answer for the current question is on its way, so it is never an answer to an old one.
 * - `reload()` asks again, after an error.
 */
export function useLiveQuery<T>(
  url: string | null,
  query?: Query,
  options: { delayMs?: number; timeoutMs?: number } = {},
) {
  const t = useTranslations("common");
  const wantedKey = url === null ? null : queryUrl(url, query);
  const key = useDebouncedValue(wantedKey, options.delayMs ?? 300);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { timeoutMs } = options;

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    api
      .get<T>(key, undefined, { signal: controller.signal, timeoutMs })
      .then((data) => setOutcome({ key, data: data ?? null, caught: null }))
      .catch((caught: unknown) => {
        if (!isAborted(caught)) setOutcome({ key, data: null, caught });
      });
    // Runs when the question changes or the screen goes away: the call in flight is no longer wanted.
    return () => controller.abort();
  }, [key, attempt, timeoutMs]);

  const settled = settledFor(wantedKey, outcome);
  return {
    data: settled?.data ?? null,
    error: settled && settled.caught !== null ? errorMessage(settled.caught, t("error")) : null,
    loading: wantedKey !== null && settled === null,
    reload: () => {
      setOutcome(null);
      setAttempt((count) => count + 1);
    },
  };
}
