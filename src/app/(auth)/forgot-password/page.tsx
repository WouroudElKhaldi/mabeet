import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/modules/accounts";
import { stagger } from "@/utils/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <>
      <h1 className="rise-in font-poster text-[2rem]">{t("title")}</h1>
      <p className="rise-in mt-3 mb-9 text-muted short:mb-5" style={stagger(1)}>
        {t("subtitle")}
      </p>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
