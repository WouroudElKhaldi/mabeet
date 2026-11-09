"use client";

import { clsx } from "clsx";
import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { FEED_SOURCES } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** "Sync now" and "Remove" for one connected calendar link. A link that fails shows its error under it after the read. */
export function FeedButtons({ businessId, feedId }: { businessId: string; feedId: string }) {
  const t = useTranslations("dashboard.channels");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const base = `/api/workspaces/${businessId}/feeds/${feedId}`;

  const remove = async () => {
    const answer = await confirm({
      title: tConfirm("removeFeed.title"),
      body: tConfirm("removeFeed.body"),
      confirmLabel: tConfirm("removeFeed.confirm"),
    });
    if (answer) await run(() => api.delete(base));
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dialog}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => void run(() => api.post(`${base}/sync`, {}))}
      >
        <RefreshCw className={clsx("size-4", pending && "animate-spin")} aria-hidden />
        {t("syncNow")}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={t("remove")}
        onClick={() => void remove()}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <FormError message={error} className="w-full" />
    </div>
  );
}

/** Connects a room to an Airbnb, Booking.com or other calendar link. It is read at once. */
export function AddFeedForm({ businessId, roomId }: { businessId: string; roomId: string }) {
  const t = useTranslations("dashboard.channels");
  const { run, pending, error } = useAction();
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<(typeof FEED_SOURCES)[number]>("AIRBNB");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const added = await run(() =>
      api.post(`/api/workspaces/${businessId}/feeds`, { roomId, url: url.trim(), source }),
    );
    if (added) setUrl("");
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]"
    >
      <select
        value={source}
        onChange={(event) =>
          setSource(FEED_SOURCES.find((option) => option === event.target.value) ?? "AIRBNB")
        }
        aria-label={t("source")}
        className={clsx(inputClass, "h-11")}
      >
        {FEED_SOURCES.map((option) => (
          <option key={option} value={option}>
            {t(`sources.${option}`)}
          </option>
        ))}
      </select>
      <input
        type="url"
        required
        dir="ltr"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.airbnb.com/calendar/ical/…"
        aria-label={t("url")}
        className={clsx(inputClass, "h-11")}
      />
      <Button type="submit" className="h-11" disabled={pending || url.trim() === ""}>
        {t("add")}
      </Button>
      <FormError message={error} className="sm:col-span-3" />
    </form>
  );
}
