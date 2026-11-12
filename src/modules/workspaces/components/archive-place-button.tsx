"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/**
 * The owner archives the place, after a second look (guests can no longer find or book it), or brings it back with
 * one press.
 */
export function ArchivePlaceButton({ businessId, archived }: { businessId: string; archived: boolean }) {
  const t = useTranslations("dashboard.settings.archive");
  const tConfirm = useTranslations("confirm.archivePlace");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const toggle = async () => {
    if (!archived) {
      const answer = await confirm({
        title: tConfirm("title"),
        body: tConfirm("body"),
        confirmLabel: tConfirm("confirm"),
      });
      if (!answer) return;
    }
    await run(() => api.put(`/api/workspaces/${businessId}/archive`, { archived: !archived }));
  };

  return (
    <div className="grid justify-items-start gap-2">
      {dialog}
      <Button variant={archived ? "primary" : "danger"} disabled={pending} onClick={() => void toggle()}>
        {archived ? t("restore") : t("archive")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
