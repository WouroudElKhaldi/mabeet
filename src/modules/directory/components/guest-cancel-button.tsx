"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * "Cancel this booking", after an "are you sure?". Anything paid online comes back in full, and the page then shows
 * the booking as cancelled. A second press while the first is working does nothing.
 */
export function GuestCancelButton({ token, online }: { token: string; online: boolean }) {
  const t = useTranslations("confirmation");
  const { confirm, dialog } = useConfirm();
  const { run, pending, error } = useAction();

  async function cancel() {
    const answer = await confirm({
      title: t("cancel.title"),
      body: online ? t("cancel.bodyOnline") : t("cancel.bodyOffline"),
      confirmLabel: t("cancel.confirm"),
      reason: { label: t("cancel.reason") },
    });
    if (!answer) return;
    await run(() =>
      api.post(
        `/api/public/bookings/${encodeURIComponent(token)}/cancel`,
        answer.reason ? { reason: answer.reason } : {},
      ),
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" disabled={pending} aria-busy={pending || undefined} onClick={cancel}>
        {t("cancelBooking")}
      </Button>
      <FormError message={error} />
      {dialog}
    </div>
  );
}
