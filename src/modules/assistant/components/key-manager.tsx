"use client";

import { KeyRound, Trash2, TriangleAlert, Unplug } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CopyField } from "@/components/ui/copy-field";
import { inputClass, panelClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** How long a new key may last, in days; "" is never. */
const EXPIRY_CHOICES = ["30", "90", "365", ""] as const;

/** An AI app the member connected to this place by signing in. */
interface ConnectedApp {
  id: string;
  name: string | null;
  /** ISO time. */
  connectedAt: string;
}

interface McpKey {
  id: string;
  name: string;
  prefix: string;
  /** May run the tools that change things; read only otherwise. */
  canWrite: boolean;
  /** ISO time, or null when the key was never used. */
  lastUsedAt: string | null;
  expiresAt: string | null;
}

/**
 * The member's MCP keys: make one (its secret shown once, with the lines to paste into Claude Code or a desktop AI
 * app), see their own, and revoke one behind a confirmation. Every key is read only. Below them, the apps the member
 * connected by signing in instead (ChatGPT, Claude.ai), each with a way to disconnect it.
 */
export function KeyManager({
  businessId,
  mcpUrl,
  keys,
  apps,
}: {
  businessId: string;
  mcpUrl: string;
  keys: McpKey[];
  apps: ConnectedApp[];
}) {
  const t = useTranslations("assistant.keys");
  const tConfirm = useTranslations("confirm");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const [secret, setSecret] = useState<string | null>(null);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(async () => {
      const key = await api.post<{ secret: string }>(`/api/workspaces/${businessId}/keys`, {
        name: data.get("name"),
        expiresInDays: Number(data.get("expires")) || null,
        canWrite: data.get("canWrite") === "on",
      });
      setSecret(key.secret);
      form.reset();
    });
  };

  const revoke = async (key: McpKey) => {
    const answer = await confirm({
      title: tConfirm("revokeKey.title", { name: key.name }),
      body: tConfirm("revokeKey.body"),
      confirmLabel: tConfirm("revokeKey.confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/keys/${key.id}`));
  };

  const disconnect = async (app: ConnectedApp) => {
    const answer = await confirm({
      title: tConfirm("disconnectApp.title", { name: app.name ?? t("unnamedApp") }),
      body: tConfirm("disconnectApp.body"),
      confirmLabel: tConfirm("disconnectApp.confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/connected-apps/${app.id}`));
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
      {dialog}
      <form onSubmit={(event) => void create(event)} className={`${panelClass} grid gap-4`}>
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-4 text-accent" aria-hidden />
          {t("create")}
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder={t("namePlaceholder")}
            aria-label={t("name")}
            className={inputClass}
          />
          <select name="expires" defaultValue="90" aria-label={t("expires")} className={inputClass}>
            {EXPIRY_CHOICES.map((days) => (
              <option key={days} value={days}>
                {days ? t("days", { count: Number(days) }) : t("never")}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-4 text-sm">
          <input type="checkbox" name="canWrite" className="mt-0.5 size-4 accent-accent" />
          <span>
            <span className="block font-semibold">{t("allowWrite")}</span>
            <span className="block text-muted">{t("allowWriteHint")}</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {t("generate")}
          </Button>
          <FormError message={error} />
        </div>
      </form>

      <AnimatePresence>
        {secret && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl bg-accent-soft p-5 ring-1 ring-accent-line"
          >
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4 text-warning" aria-hidden />
              {t("copyNow")}
            </p>
            <CopyField value={secret} label={t("secret")} />
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <p className="text-sm font-semibold">{t("claudeCode")}</p>
              <CopyField
                value={`claude mcp add --transport http mabeet ${mcpUrl} --header "Authorization: Bearer ${secret}"`}
                label={t("claudeCode")}
              />
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <p className="text-sm font-semibold">{t("desktop")}</p>
              <CopyField
                value={JSON.stringify({
                  mcpServers: {
                    mabeet: {
                      command: "npx",
                      args: ["mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${secret}`],
                    },
                  },
                })}
                label={t("desktop")}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="justify-self-start"
              onClick={() => setSecret(null)}
            >
              {t("done")}
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">{t("yourKeys")}</h2>
        {keys.length === 0 ? (
          <p className="text-muted">{t("noKeys")}</p>
        ) : (
          <ul className="grid gap-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {key.name} <code className="ms-2 text-xs text-muted">{key.prefix}…</code>
                  </p>
                  {/* In the viewer's own time zone, which the server cannot know. */}
                  <p className="text-sm text-muted" suppressHydrationWarning>
                    {key.canWrite ? t("readWrite") : t("readOnly")} ·{" "}
                    {key.lastUsedAt
                      ? t("lastUsed", { when: new Date(key.lastUsedAt).toLocaleString(locale) })
                      : t("neverUsed")}
                  </p>
                </div>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => void revoke(key)}>
                  <Trash2 className="size-4" aria-hidden />
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-2xl font-semibold">{t("connectedApps")}</h2>
        <p className="text-muted">{t("signInHint")}</p>
        <CopyField value={mcpUrl} label={t("serverAddress")} />
        {apps.length === 0 ? (
          <p className="text-muted">{t("noApps")}</p>
        ) : (
          <ul className="grid gap-2">
            {apps.map((app) => (
              <li
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{app.name ?? t("unnamedApp")}</p>
                  {/* In the viewer's own time zone, which the server cannot know. */}
                  <p className="text-sm text-muted" suppressHydrationWarning>
                    {t("readOnly")} ·{" "}
                    {t("connectedOn", { when: new Date(app.connectedAt).toLocaleString(locale) })}
                  </p>
                </div>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => void disconnect(app)}>
                  <Unplug className="size-4" aria-hidden />
                  {t("disconnect")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
