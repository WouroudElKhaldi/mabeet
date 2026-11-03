import { getTranslations } from "next-intl/server";
import type { PublicPlace } from "../types";

/** Check-in and check-out times, how payment works, the house rules and the one refund rule. */
export async function ThingsToKnow({
  place,
}: {
  place: Pick<PublicPlace, "checkInTime" | "checkOutTime" | "houseRules">;
}) {
  const t = await getTranslations("placePage");
  const refund = await getTranslations("refundPolicy");
  const rows = [
    { label: t("checkIn"), body: t("after", { time: place.checkInTime }) },
    { label: t("checkOut"), body: t("before", { time: place.checkOutTime }) },
    { label: t("payment"), body: t("paymentValue") },
    { label: t("cancellation"), body: refund("full") },
    ...(place.houseRules ? [{ label: t("houseRules"), body: place.houseRules }] : []),
  ];
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {rows.map(({ label, body }) => (
        <div key={label}>
          <dt className="text-sm font-semibold text-muted">{label}</dt>
          <dd className="mt-1 whitespace-pre-line">{body}</dd>
        </div>
      ))}
    </dl>
  );
}
