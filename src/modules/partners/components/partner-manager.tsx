"use client";

import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { type PartnerFields, PartnerForm } from "./partner-form";
import { PartnerSponsorships, type SponsorshipDays } from "./partner-sponsorships";

// The partner places near our guesthouses. The admin's table lists them; adding one, and changing one with its
// sponsored days, open in a pop-up. A removed partner stays in the table's "Removed" view, to bring back.

export interface AdminPartner extends PartnerFields {
  isDeleted: boolean;
  /** The sponsorships not over yet, soonest first. */
  sponsorships: SponsorshipDays[];
}

/** The page's "New partner" button: the form in a pop-up. */
export function NewPartnerButton() {
  const t = useTranslations("admin.partners");
  return (
    <FormDialog label={t("new")} title={t("new")} size="lg">
      <PartnerForm />
    </FormDialog>
  );
}

/** A row's buttons: edit a live partner and its sponsored days in a pop-up, or remove it; bring back a removed one. */
export function PartnerActions({ partner }: { partner: AdminPartner }) {
  const t = useTranslations("admin.partners");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const remove = async () => {
    const answer = await confirm({
      title: t("removeTitle", { name: partner.name }),
      body: t("removeBody"),
      confirmLabel: t("remove"),
    });
    if (answer) await run(() => api.delete(`/api/admin/partners/${partner.id}`));
  };

  if (partner.isDeleted) {
    return (
      <div className="grid justify-items-end gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => void run(() => api.post(`/api/admin/partners/${partner.id}/restore`))}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("restore")}
        </Button>
        <FormError message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dialog}
      <FormDialog
        label={t("edit")}
        title={t("editTitle", { name: partner.name })}
        icon={<Pencil className="size-4" aria-hidden />}
        variant="secondary"
        size="lg"
      >
        <PartnerForm partner={partner} />
        <PartnerSponsorships
          partnerId={partner.id}
          partnerName={partner.name}
          sponsorships={partner.sponsorships}
        />
      </FormDialog>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={t("removeTitle", { name: partner.name })}
        title={t("remove")}
        onClick={() => void remove()}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <FormError message={error} />
    </div>
  );
}
