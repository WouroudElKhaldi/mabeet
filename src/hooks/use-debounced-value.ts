"use client";

import { useEffect, useState } from "react";

/**
 * A value that follows `value` only once it has stopped changing for `delayMs`: a search box typed into quickly gives
 * one search, not one for every key. The first value is used at once.
 *
 *   const text = useDebouncedValue(typed, 300);   // search with `text`, show `typed` in the box
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
