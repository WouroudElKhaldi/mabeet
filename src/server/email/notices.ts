import { isArabic } from "@/config/appearance";
import { env } from "@/server/env";

// The small pieces every email and notice shares, whichever module sends it. Lebanese readers get the Arabic
// emails.

export type NoticeLanguage = "en" | "ar";

/** Queues a notice. Failing to queue it is logged, never thrown at the change that caused it. */
export function queueNotice<Data extends object>(
  job: { kind: string; enqueue(data: Data): Promise<unknown> },
  data: Data,
) {
  job.enqueue(data).catch((error: unknown) => console.error(`[jobs] could not queue ${job.kind}`, error));
}

export const noticeLanguage = (locale: string | null | undefined): NoticeLanguage =>
  locale && isArabic(locale) ? "ar" : "en";

export const appUrl = (path: string) => new URL(path, env.BETTER_AUTH_URL).toString();

export const firstName = (name: string) => name.split(" ")[0] ?? name;
