"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * What the place's team does with one review: answer it in public (an empty answer takes it away), hide it from
 * guests with a reason the team will read later, or show it again. Nothing here deletes a review.
 */
export function ReviewControls({
  businessId,
  reviewId,
  ownerReply,
  hidden,
}: {
  businessId: string;
  reviewId: string;
  ownerReply: string | null;
  hidden: boolean;
}) {
  const t = useTranslations("dashboard.reviews");
  const reply = useAction();
  const visibility = useAction();
  const [hiding, setHiding] = useState(false);
  const base = `/api/workspaces/${businessId}/reviews/${reviewId}`;

  const saveReply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("reply") ?? "");
    void reply.run(() => api.put(`${base}/reply`, { reply: text }));
  };

  const hide = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    if (await visibility.run(() => api.put(`${base}/visibility`, { hidden: true, reason }))) setHiding(false);
  };

  return (
    <div className="grid gap-4">
      <form onSubmit={saveReply} className="grid gap-3">
        <TextArea
          label={t("reply")}
          name="reply"
          defaultValue={ownerReply ?? ""}
          maxLength={1000}
          rows={3}
          placeholder={t("replyPlaceholder")}
          hint={t("replyHint")}
        />
        <FormError message={reply.error} />
        <div>
          <Button type="submit" size="sm" disabled={reply.pending}>
            {ownerReply ? t("updateReply") : t("reply")}
          </Button>
        </div>
      </form>

      {hiding ? null : <FormError message={visibility.error} />}
      <div>
        {hidden ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={visibility.pending}
            onClick={() => void visibility.run(() => api.put(`${base}/visibility`, { hidden: false }))}
          >
            <Eye className="size-4" aria-hidden />
            {t("show")}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setHiding(true)}>
            <EyeOff className="size-4" aria-hidden />
            {t("hide")}
          </Button>
        )}
      </div>

      <SheetDialog open={hiding} onClose={() => setHiding(false)} title={t("hide")} compact>
        <form onSubmit={hide} className="grid gap-5 p-5 sm:p-6">
          <TextArea label={t("hideReason")} name="reason" required minLength={3} maxLength={500} rows={3} />
          <FormError message={visibility.error} />
          <Button type="submit" variant="danger" disabled={visibility.pending} className="w-full">
            {t("hide")}
          </Button>
        </form>
      </SheetDialog>
    </div>
  );
}
