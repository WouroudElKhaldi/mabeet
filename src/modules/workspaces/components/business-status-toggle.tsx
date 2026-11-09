"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * The platform admin suspends a business (after a second look: it disappears for its guests and its team at once)
 * or reactivates it with one press.
 */
export function BusinessStatusToggle({
  businessId,
  businessName,
  suspended,
}: {
  businessId: string;
  businessName: string;
  suspended: boolean;
}) {
  const t = useTranslations("admin");
  const tConfirm = useTranslations("confirm.suspend");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const toggle = async () => {
    if (!suspended) {
      const answer = await confirm({
        title: tConfirm("title", { name: businessName }),
        body: tConfirm("body"),
        confirmLabel: tConfirm("confirm"),
      });
      if (!answer) return;
    }
    await run(() =>
      api.patch(`/api/admin/businesses/${businessId}`, { status: suspended ? "ACTIVE" : "SUSPENDED" }),
    );
  };

  return (
    <div className="grid justify-items-end gap-1">
      {dialog}
      <Button
        size="sm"
        variant={suspended ? "secondary" : "ghost"}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {suspended ? t("reactivate") : t("suspend")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
