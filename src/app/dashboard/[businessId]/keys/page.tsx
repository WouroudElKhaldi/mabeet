import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { KeyManager } from "@/modules/assistant";
import { listKeys, listToolCalls } from "@/modules/assistant/server";
import { env } from "@/server/env";
import { requirePageAccess } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/** How many of the latest AI tool calls the page lists. */
const CALLS_SHOWN = 20;

/**
 * Connect your own AI app: make a personal key (read only), copy how to add it to Claude Code or a desktop app, and
 * see what the AI looked at in this place.
 */
export default async function KeysPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.keys.anyOf);
  const [t, locale, keys, calls] = await Promise.all([
    getTranslations("assistant.keys"),
    getLocale(),
    listKeys(ctx),
    listToolCalls(ctx, CALLS_SHOWN),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        <KeyManager
          businessId={businessId}
          mcpUrl={new URL("/api/mcp", env.BETTER_AUTH_URL).toString()}
          keys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            expiresAt: key.expiresAt?.toISOString() ?? null,
          }))}
        />
        <Panel title={t("auditTitle")} intro={t("auditHint")}>
          {calls.length === 0 ? (
            <p className="text-sm text-muted">{t("noCalls")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {calls.map((call) => (
                <li
                  key={call.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <code className="font-semibold">{call.tool}</code>
                  <span className="text-muted">
                    {call.outcome === "ok" ? t("ok") : call.outcome} · {call.latencyMs} ms ·{" "}
                    {when.format(call.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
