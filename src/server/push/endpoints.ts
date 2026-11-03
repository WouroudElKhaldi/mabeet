// Which addresses a browser's push subscription may name. Pure, so the input checks can use it in the browser too.

// Browsers hand out addresses on their maker's push service. Accepting only those keeps a forged subscription from
// making the server call an address of someone else's choosing.
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushServiceUrl(endpoint: string): boolean {
  const url = URL.parse(endpoint);
  if (url?.protocol !== "https:") return false;
  return PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}
