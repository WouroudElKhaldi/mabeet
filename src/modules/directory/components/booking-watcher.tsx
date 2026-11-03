"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the booking page current while it waits for something outside it: the payment (the guest comes back from the
 * payment page before the confirmation has arrived) or the host's answer. It asks the server to draw the page again
 * every `everySeconds`, only while the tab is in view, and stops when the booking needs nothing more (`null`).
 */
export function BookingWatcher({ everySeconds }: { everySeconds: number | null }) {
  const router = useRouter();
  useEffect(() => {
    if (everySeconds === null) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, everySeconds * 1000);
    return () => clearInterval(timer);
  }, [everySeconds, router]);
  return null;
}
