import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { PasswordForm, ProfileForm } from "@/modules/accounts";
import { getMyProfile } from "@/modules/accounts/server";
import { HostProfileForm } from "@/modules/workspaces";
import { getMyHostProfile } from "@/modules/workspaces/server";
import { isBusinessOwner } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The signed-in person's own profile: their details and password, which follow them into every business, and for the
 * business's own owners their host profile, the one guests meet on every place they own. A platform admin visiting
 * the business is not its host, so they get only their own details.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const host = isBusinessOwner(ctx);
  const [t, tHost, profile, hostProfile] = await Promise.all([
    getTranslations("profile"),
    getTranslations("hostProfile"),
    getMyProfile(ctx.userId),
    host ? getMyHostProfile(ctx) : null,
  ]);
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
        <ProfileForm profile={profile} />
        {host && (
          <section aria-labelledby="host-profile" className="grid gap-3">
            <div>
              <h2 id="host-profile" className="text-xl font-semibold">
                {tHost("title")}
              </h2>
              <p className="mt-1 text-sm text-muted">{tHost("intro")}</p>
            </div>
            <HostProfileForm businessId={businessId} profile={hostProfile} />
          </section>
        )}
        <PasswordForm />
      </div>
    </>
  );
}
