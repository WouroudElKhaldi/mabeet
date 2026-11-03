/* Mabeet service worker: shows push notifications, and keeps a friendly offline page for when the phone has no
   signal. Pages themselves are never cached: bookings must be live. The worker only answers when the network fails, so with a connection every
   request goes to the server as if it were not there. */
const CACHE = "mabeet-offline-v2";
const OFFLINE_URL = "/offline";

/** What the offline page needs to look right with no connection: our stylesheets, fonts and logo shapes. */
const isPageAsset = (url) =>
  url.origin === self.location.origin &&
  ((url.pathname.startsWith("/_next/static/") && /\.(css|woff2)$/.test(url.pathname)) ||
    url.pathname.startsWith("/brand/"));

/** Every address an HTML page or a stylesheet points to, resolved against where it was found. */
function linkedUrls(text, base) {
  const found = text.matchAll(/(?:href=|src=|url\()\s*["']?([^"'()\s>]+)/g);
  return [...found].map((match) => new URL(match[1].replaceAll("&amp;", "&"), base));
}

/**
 * Saves the offline page and its assets, read from the page itself, so they always match: a new build changes the
 * stylesheet names, and the copy saved with that build names the stylesheets saved beside it.
 */
async function saveOfflinePage() {
  const cache = await caches.open(CACHE);
  const page = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!page.ok) throw new Error(`The offline page answered ${page.status}`);
  const pageUrl = new URL(OFFLINE_URL, self.location.origin);
  const assets = new Map();
  for (const url of linkedUrls(await page.clone().text(), pageUrl)) {
    if (isPageAsset(url)) assets.set(url.pathname, url);
  }
  // Fonts are named inside the stylesheets, not in the page.
  for (const url of [...assets.values()].filter((asset) => asset.pathname.endsWith(".css"))) {
    const css = await (await fetch(url)).text();
    for (const font of linkedUrls(css, url)) if (isPageAsset(font)) assets.set(font.pathname, font);
  }
  await cache.addAll([...assets.keys()]);
  await cache.put(OFFLINE_URL, page);
}

self.addEventListener("install", (event) => {
  event.waitUntil(saveOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (!isPageAsset(new URL(request.url))) return;
  event.respondWith(
    fetch(request).catch(
      async () => (await caches.match(request, { ignoreSearch: true })) ?? Response.error(),
    ),
  );
});

/** The default palette's icon: the worker cannot know which palette the site shows. */
const ICON = "/brand/icons/cedar/icon.png";

self.addEventListener("push", (event) => {
  let message = { title: "Mabeet", body: "", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // An empty or unreadable push still shows the default notification.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: ICON,
      badge: ICON,
      data: { url: message.url },
    }),
  );
});

/** Opens the notification's page, in a Mabeet window already open when there is one. Only pages of this site. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client);
      if (open) return open.navigate(url).then((client) => (client ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
