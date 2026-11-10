"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { DisclosurePanel } from "@/components/shell/disclosure-panel";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { REGION_KEYS } from "@/config/regions";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { type PartnerFields, PartnerForm } from "./partner-form";
import { PartnerSponsorships, type SponsorshipDays } from "./partner-sponsorships";

export interface AdminPartner extends PartnerFields {
  isDeleted: boolean;
  /** The sponsorships not over yet, soonest first. */
  sponsorships: SponsorshipDays[];
}

/**
 * The partner places near our guesthouses: each live one opens to its editor, its sponsored days and Remove; a new
 * one is added at the end; removed ones are listed last, to bring back. `today` (an ISO day) says which partners are
 * sponsored right now.
 */
export function PartnerManager({ partners, today }: { partners: AdminPartner[]; today: string }) {
  const t = useTranslations("admin.partners");
  const kinds = useTranslations("partners.kinds");
  const regions = useTranslations("regions.names");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const live = partners.filter((partner) => !partner.isDeleted);
  const removed = partners.filter((partner) => partner.isDeleted);

  const remove = async (partner: AdminPartner) => {
    const answer = await confirm({
      title: t("removeTitle", { name: partner.name }),
      body: t("removeBody"),
      confirmLabel: t("remove"),
    });
    if (answer) await run(() => api.delete(`/api/admin/partners/${partner.id}`));
  };

  const restore = (partner: AdminPartner) =>
    void run(() => api.post(`/api/admin/partners/${partner.id}/restore`));

  // The panel's bar keeps one short word beside the name, so it fits a phone: whether it is sponsored now, else its
  // kind. The region is in the editor inside.
  const status = (partner: AdminPartner) =>
    partner.sponsorships.some((sponsorship) => sponsorship.startsOn <= today)
      ? t("sponsoredNow")
      : kinds(partner.kind);

  const description = (partner: AdminPartner) => {
    // Every partner's region was checked against the list when it was saved; the database only knows it as text.
    const region = REGION_KEYS.find((key) => key === partner.region);
    return `${kinds(partner.kind)} · ${region ? regions(region) : partner.region}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {dialog}
      {live.length === 0 ? <p className="text-muted">{t("empty")}</p> : null}
      {live.map((partner) => (
        <DisclosurePanel key={partner.id} title={partner.name} status={status(partner)}>
          <PartnerForm partner={partner} />
          <PartnerSponsorships
            partnerId={partner.id}
            partnerName={partner.name}
            sponsorships={partner.sponsorships}
          />
          <div className="mt-6 border-t border-line pt-6">
            <Button variant="danger" size="sm" disabled={pending} onClick={() => void remove(partner)}>
              <Trash2 className="size-4" aria-hidden />
              {t("remove")}
            </Button>
          </div>
        </DisclosurePanel>
      ))}

      <DisclosurePanel title={t("new")} defaultOpen={live.length === 0}>
        <PartnerForm />
      </DisclosurePanel>

      {removed.length > 0 ? (
        <section aria-labelledby="removed-partners" className="mt-6">
          <h2 id="removed-partners" className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">
            {t("removedTitle")}
          </h2>
          <ul className="grid gap-2">
            {removed.map((partner) => (
              <li
                key={partner.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 ring-1 ring-line"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{partner.name}</span>
                  <span className="block truncate text-sm text-muted">{description(partner)}</span>
                </span>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => restore(partner)}>
                  <RotateCcw className="size-4" aria-hidden />
                  {t("restore")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <FormError message={error} />
    </div>
  );
}
