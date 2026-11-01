import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/modules/accounts";
import { AcceptInvitation, InvitationSignUp } from "@/modules/team";
import { getInvitation } from "@/modules/team/server";
import { buttonClass } from "@/components/ui/button";
import { getCurrentUser } from "@/server/http/session";
import { stagger } from "@/utils/motion";
import { signInUrl } from "@/utils/sign-in-url";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invitation");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

/**
 * Where an invitation email leads. A new person registers here; someone with an account signs in and accepts.
 * Either way they join with the role the host chose, which they can't change.
 */
export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const [t, invitation, user] = await Promise.all([
    getTranslations("invitation"),
    getInvitation(token),
    getCurrentUser(),
  ]);

  if (!invitation || invitation.status === "CANCELLED") {
    return <Notice title={t("invalid.title")} body={t("invalid.body")} />;
  }
  if (invitation.status === "EXPIRED") {
    return <Notice title={t("expired.title")} body={t("expired.body", { name: invitation.invitedByName })} />;
  }
  if (invitation.status === "ACCEPTED") {
    return (
      <Notice title={t("accepted.title")} body={t("accepted.body", { place: invitation.businessName })}>
        <Link
          href={signInUrl(`/dashboard/${invitation.businessId}`)}
          className={buttonClass({ size: "lg", className: "mt-6" })}
        >
          {t("accepted.open")}
        </Link>
      </Notice>
    );
  }

  const intro = (
    <>
      <h1 className="rise-in font-poster text-[2rem]">{t("title", { place: invitation.businessName })}</h1>
      <p className="rise-in mt-3 mb-9 text-muted short:mb-5" style={stagger(1)}>
        {t.rich("subtitle", {
          name: invitation.invitedByName,
          role: invitation.roleName,
          strong: (chunk) => <strong className="text-ink">{chunk}</strong>,
        })}
      </p>
    </>
  );

  if (user && user.email.toLowerCase() === invitation.email) {
    return (
      <>
        {intro}
        <AcceptInvitation token={token} businessId={invitation.businessId} />
      </>
    );
  }
  if (user) {
    return (
      <>
        {intro}
        <p className="mb-6 rounded-md bg-surface-2 p-4 text-sm">
          {t("otherAccount", { email: invitation.email, current: user.email })}
        </p>
        <SignOutButton />
      </>
    );
  }
  if (invitation.hasAccount) {
    return (
      <>
        {intro}
        <p className="mb-6 text-muted">{t("signInFirst", { email: invitation.email })}</p>
        <Link
          href={signInUrl(`/invite/${token}`)}
          className={buttonClass({ size: "lg", className: "w-full" })}
        >
          {t("signIn")}
        </Link>
      </>
    );
  }
  return (
    <>
      {intro}
      <InvitationSignUp
        token={token}
        email={invitation.email}
        defaults={{ name: invitation.name, phone: invitation.phone }}
        businessId={invitation.businessId}
      />
    </>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="rise-in font-poster text-[2rem]">{title}</h1>
      <p className="mt-3 text-muted">{body}</p>
      {children}
    </>
  );
}
