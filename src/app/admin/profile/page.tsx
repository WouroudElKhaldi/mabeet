import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { PasswordForm, ProfileForm } from "@/modules/accounts";
import { getMyProfile } from "@/modules/accounts/server";
import { requirePageAdmin } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

/** The platform admin's own details and password. */
export default async function AdminProfilePage() {
  const actor = await requirePageAdmin();
  const [t, profile] = await Promise.all([getTranslations("profile"), getMyProfile(actor.userId)]);
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
        <ProfileForm profile={profile} />
        <PasswordForm />
      </div>
    </>
  );
}
