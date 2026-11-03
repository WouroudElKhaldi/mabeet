"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on every page, so a visitor with no connection sees the offline page. It also runs
 * during development: the worker only answers when the network fails, so it never stands between the browser and
 * a running dev server, and stopping the server is how the offline page is checked.
 */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);
  return null;
}
