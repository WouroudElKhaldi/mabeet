import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { HostProfileForm } from "@/modules/workspaces";
import { getMyHostProfile } from "@/modules/workspaces/server";
import { isBusinessOwner } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The owner's host profile: who guests meet on every one of their places, and how guests reach them. Owners only; a
 * platform admin visiting the business is not its host, so they see the profile on the admin's host page instead.
 */
export default async function HostProfilePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  if (!isBusinessOwner(ctx)) notFound();
  const [t, profile] = await Promise.all([getTranslations("hostProfile"), getMyHostProfile(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="max-w-3xl">
        <HostProfileForm businessId={businessId} profile={profile} />
      </div>
    </>
  );
}
