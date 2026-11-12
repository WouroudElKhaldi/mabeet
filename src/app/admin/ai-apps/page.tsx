import clsx from "clsx";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { AI_CALL_CHANNELS, AI_USAGE_PERIODS } from "@/config/enums";
import { aiUsageQuery } from "@/modules/assistant";
import { getAiUsage } from "@/modules/assistant/server";
import { requirePageAdmin } from "@/server/http/session";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/ai-apps";
const DEFAULT_PERIOD = "30";

/**
 * How often each AI tool is called across the platform: by hosts' own AI apps, the dashboard chat and guests through
 * the public guest MCP, over the last 7, 30 or 90 days, with the calls that failed and how long they took.
 */
export default async function AdminAiAppsPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const period = aiUsageQuery.parse(await searchParams).days ?? DEFAULT_PERIOD;
  const [t, locale, usage] = await Promise.all([
    getTranslations("admin.aiApps"),
    getLocale(),
    getAiUsage(actor, Number(period)),
  ]);
  const count = new Intl.NumberFormat(locale);
  const seconds = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <nav aria-label={t("period")} className="mb-6 flex flex-wrap gap-1.5">
        {AI_USAGE_PERIODS.map((days) => (
          <Link
            key={days}
            href={days === DEFAULT_PERIOD ? PATH : `${PATH}?days=${days}`}
            aria-current={days === period ? "page" : undefined}
            className={clsx(
              "h-9 rounded-full px-3.5 text-sm leading-9 font-semibold ring-1",
              days === period ? "bg-ink text-paper ring-ink" : "ring-line hover:bg-surface-2",
            )}
          >
            {t("lastDays", { days: Number(days) })}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <section aria-label={t("totals")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile kind="count" label={t("calls")} value={usage.total} />
          {AI_CALL_CHANNELS.map((channel) => (
            <StatTile
              key={channel}
              kind="count"
              label={t(`channels.${channel}`)}
              value={usage.byChannel[channel]}
            />
          ))}
        </section>
        {usage.tools.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
        ) : (
          <DataTable
            label={t("byTool")}
            columns={[
              { label: t("tool") },
              { label: t("channel"), wide: true },
              { label: t("calls"), align: "end" },
              { label: t("failed"), align: "end", wide: true },
              { label: t("averageTime"), align: "end", wide: true },
            ]}
          >
            {usage.tools.map((row) => (
              <DataRow key={`${row.tool} ${row.channel}`}>
                <DataCell>
                  <p className="font-mono text-xs font-semibold">
                    <bdi>{row.tool}</bdi>
                  </p>
                  <p className="text-muted md:hidden">{t(`channels.${row.channel}`)}</p>
                </DataCell>
                <DataCell wide>
                  <Pill tone={row.channel === "guest" ? "accent" : "quiet"}>
                    {t(`channels.${row.channel}`)}
                  </Pill>
                </DataCell>
                <DataCell align="end" className="tabular-nums">
                  {count.format(row.calls)}
                </DataCell>
                <DataCell align="end" wide className={clsx("tabular-nums", row.failed > 0 && "text-danger")}>
                  {count.format(row.failed)}
                </DataCell>
                <DataCell align="end" wide className="whitespace-nowrap tabular-nums">
                  {t("seconds", { value: seconds.format(row.averageMs / 1000) })}
                </DataCell>
              </DataRow>
            ))}
          </DataTable>
        )}
        {usage.failed > 0 ? (
          <p className="text-sm text-muted">{t("failedNote", { count: usage.failed })}</p>
        ) : null}
      </div>
    </>
  );
}
