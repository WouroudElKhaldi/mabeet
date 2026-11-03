"use client";

import { KeyRound, Trash2, TriangleAlert } from "lucide-react";
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

interface McpKey {
  id: string;
  name: string;
  prefix: string;
  /** ISO time, or null when the key was never used. */
  lastUsedAt: string | null;
  expiresAt: string | null;
}

/**
 * The member's MCP keys: make one (its secret shown once, with the lines to paste into Claude Code or a desktop AI
 * app), see their own, and revoke one behind a confirmation. Every key is read only.
 */
export function KeyManager({
  businessId,
  mcpUrl,
  keys,
}: {
  businessId: string;
  mcpUrl: string;
  keys: McpKey[];
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
                    {t("readOnly")} ·{" "}
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
    </div>
  );
}
