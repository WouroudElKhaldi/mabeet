"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

type Decision = "confirm" | "decline" | "cancel";

/**
 * The host's answers on one booking row: Confirm and Decline while it waits for them, Cancel once it is confirmed
 * and the stay has not started. Each one asks first; the server checks the same rules again.
 */
export function BookingActions({
  businessId,
  bookingId,
  decisions,
}: {
  businessId: string;
  bookingId: string;
  decisions: readonly Decision[];
}) {
  const t = useTranslations("dashboard.bookings");
  const tConfirm = useTranslations("confirm");
  const { confirm, dialog } = useConfirm();
  const { run, pending, error } = useAction();
  // The answer being sent: its button spins, and every answer waits until it is done.
  const [sending, setSending] = useState<Decision | null>(null);

  const questions = {
    confirm: {
      title: tConfirm("confirmBooking.title"),
      body: tConfirm("confirmBooking.body"),
      confirmLabel: tConfirm("confirmBooking.confirm"),
      tone: "primary",
    },
    decline: {
      title: tConfirm("decline.title"),
      body: tConfirm("decline.body"),
      confirmLabel: tConfirm("decline.confirm"),
      reason: { label: tConfirm("reasonOptional") },
    },
    cancel: {
      title: tConfirm("cancel.title"),
      body: tConfirm("cancel.body"),
      confirmLabel: tConfirm("cancel.confirm"),
      reason: { label: tConfirm("reasonOptional") },
    },
  } as const;

  async function decide(decision: Decision) {
    const answer = await confirm(questions[decision]);
    if (!answer) return;
    setSending(decision);
    await run(() =>
      api.post(`/api/workspaces/${businessId}/bookings/${bookingId}/${decision}`, {
        reason: answer.reason || undefined,
      }),
    );
  }

  if (decisions.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {decisions.map((decision) => {
          const spinning = pending && sending === decision;
          return (
            <Button
              key={decision}
              size="sm"
              variant={decision === "confirm" ? "primary" : "danger"}
              disabled={pending}
              aria-busy={spinning}
              onClick={() => decide(decision)}
            >
              {spinning && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t(decision)}
            </Button>
          );
        })}
      </div>
      <FormError message={error} />
      {dialog}
    </div>
  );
}
