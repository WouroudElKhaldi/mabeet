import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { invalid } from "@/server/errors";

/** The scheduled sync waits this long for a calendar; a guest's booking waits less (see `readFeed`). */
export const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000;

// Hosts paste any link and our server downloads it, so anything that points inside a network is refused (SSRF).
const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

// BlockList also matches IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) against the IPv4 rules.
function isPrivateAddress(address: string): boolean {
  return privateRanges.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/** Throws unless the link is https and every address its name resolves to is public. */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw invalid("Calendar links must start with https://");
  if (url.username || url.password) throw invalid("Calendar links cannot contain a user name or password");
  // An IPv6 address keeps its brackets in URL.hostname ("[::1]"); the resolver needs it without them.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const addresses = await lookup(host, { all: true }).catch(() => {
    throw invalid("That calendar link's website could not be found");
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw invalid("That calendar link points to a private address");
  }
  return url;
}

/** Downloads a public calendar with a time limit, a size limit and no redirects. */
export async function fetchCalendarText(rawUrl: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const url = await assertPublicHttpsUrl(rawUrl);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "text/calendar" },
  }).catch(() => {
    throw invalid("The calendar link did not answer in time");
  });
  if (!response.ok) throw invalid(`The calendar link answered with status ${response.status}`);
  const text = await readCapped(response, MAX_BYTES);
  if (!text.includes("BEGIN:VCALENDAR")) throw invalid("That link is not an iCal calendar");
  return text;
}

/** Reads a body but stops (and cancels the download) as soon as it passes the limit, so a huge file never fills memory. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const tooLarge = () => invalid("That calendar is too large");
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) throw tooLarge();
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
