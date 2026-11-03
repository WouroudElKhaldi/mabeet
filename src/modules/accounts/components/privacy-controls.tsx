"use client";

import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { signOutAndLeave } from "@/lib/auth-client";

/** Download everything Mabeet holds about you, or delete the account after typing your email to confirm. */
export function PrivacyControls({ email }: { email: string }) {
  const t = useTranslations("account.privacy");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const remove = async () => {
    const answer = await confirm({
      title: t("deleteTitle"),
      body: t("deleteBody"),
      confirmLabel: t("deleteConfirm"),
      reason: { label: t("typeEmail"), required: true, placeholder: email },
    });
    if (!answer) return;
    if (await run(() => api.post("/api/me/delete", { email: answer.reason }))) await signOutAndLeave();
  };

  return (
    <div className="grid gap-6">
      {dialog}
      <section className="rounded-2xl p-6 ring-1 ring-line">
        <h2 className="text-lg font-semibold">{t("downloadTitle")}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("downloadBody")}</p>
        <a
          href="/api/me/export"
          download
          className={buttonClass({ variant: "secondary", className: "mt-5" })}
        >
          <Download className="size-4" aria-hidden />
          {t("download")}
        </a>
      </section>
      <section className="rounded-2xl p-6 ring-1 ring-danger/40">
        <h2 className="text-lg font-semibold text-danger">{t("deleteTitle")}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("deleteIntro")}</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void remove()}
          className={buttonClass({ variant: "danger", className: "mt-5" })}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("delete")}
        </button>
        <FormError message={error} className="mt-3" />
      </section>
    </div>
  );
}
