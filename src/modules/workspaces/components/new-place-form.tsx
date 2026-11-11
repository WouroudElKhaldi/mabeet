"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";

/**
 * Adding another place from inside the dashboard, in a pop-up: only its name and town. A host already here knows
 * Mabeet, so there is no plan to pick and nothing to pay: each place has its own plan and starts on Free, changed later
 * on its Billing page. It goes straight into the new place, where its setup checklist leads the way.
 */
export function NewPlaceForm() {
  const t = useTranslations("host");
  const { run, pending, error } = useRedirectAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      const { id } = await api.post<{ id: string }>("/api/workspaces", {
        name: data.get("name"),
        area: String(data.get("area") ?? "") || undefined,
      });
      return { url: `/dashboard/${id}` };
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Field label={t("placeName")} name="name" required minLength={2} maxLength={80} data-autofocus />
      <Field label={t("area")} name="area" maxLength={80} />
      <p className="text-sm text-muted">{t("newPlaceNote")}</p>
      <FormError message={error} />
      <Button type="submit" disabled={pending} className={`w-fit ${slideParent}`}>
        <SlideLabel icon={pending ? LoaderCircle : ArrowRight} flipInRtl={!pending} spinning={pending}>
          {t("addPlace")}
        </SlideLabel>
      </Button>
    </form>
  );
}
