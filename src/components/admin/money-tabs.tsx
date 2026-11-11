import { getTranslations } from "next-intl/server";
import { ChoiceLinks } from "@/components/ui/choice-links";

/** The parts of the admin's money pages, each its own address under /admin/money. */
const MONEY_TABS = {
  overview: "/admin/money",
  requests: "/admin/money/requests",
  refunds: "/admin/money/refunds",
  balances: "/admin/money/balances",
  history: "/admin/money/payouts",
} as const;

export type MoneyTab = keyof typeof MONEY_TABS;

/** Where each money list lives, for the filters and pages of the list on screen. */
export const moneyTabPath = (tab: MoneyTab) => MONEY_TABS[tab];

/**
 * The tabs above the admin's money pages: the overview (what Mabeet earned), then each long list on its own page,
 * so every list is a table with its own search and pages.
 */
export async function MoneyTabs({ current }: { current: MoneyTab }) {
  const t = await getTranslations("admin.money.tabs");
  const tabs = Object.keys(MONEY_TABS) as MoneyTab[];
  return (
    <div className="mb-6">
      <ChoiceLinks
        label={t("label")}
        choices={tabs.map((tab) => ({ href: MONEY_TABS[tab], label: t(tab), current: tab === current }))}
      />
    </div>
  );
}
