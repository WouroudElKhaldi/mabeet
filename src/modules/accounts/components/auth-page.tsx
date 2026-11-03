import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { stagger } from "@/utils/motion";
import { AuthForm } from "./auth-form";

export async function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="rise-in font-poster text-[2rem]">{t(`${mode}.title`)}</h1>
      <p className="rise-in mt-3 mb-9 text-muted short:mb-5" style={stagger(1)}>
        {t(`${mode}.subtitle`)}
      </p>
      <Suspense>
        <AuthForm mode={mode} />
      </Suspense>
    </>
  );
}

export async function authMetadata(mode: "sign-in" | "sign-up"): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t(`${mode}.title`) };
}
