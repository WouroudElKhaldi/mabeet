// How long an experience or service lasts, in the words its card and its page share: "2 hours", or "45 min" under
// an hour.

type DurationText = (key: "hours" | "minutes", values: { count: number }) => string;

export function durationText(t: DurationText, minutes: number): string {
  return minutes < 60
    ? t("minutes", { count: minutes })
    : t("hours", { count: Math.round(minutes / 6) / 10 });
}
