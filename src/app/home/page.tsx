import { redirect } from "next/navigation";
import { listWorkspaces } from "@/modules/team/server";
import { requirePageUser } from "@/server/http/session";

/**
 * Where everyone lands after signing in or confirming their email: admins to /admin, hosts and staff to their
 * dashboard, guests home. A confirmation link that failed arrives with ?error=, and goes to sign in to say so.
 */
export default async function HomeAfterSignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (error) redirect(`/sign-in?error=${encodeURIComponent(error)}`);
  const user = await requirePageUser();
  if (user.platformRole === "SUPER_ADMIN") redirect("/admin");
  const workspaces = await listWorkspaces(user.id);
  // Several places: the "all my places" overview; one: straight to it.
  redirect(
    workspaces.length > 1 ? "/dashboard" : workspaces[0] ? `/dashboard/${workspaces[0].businessId}` : "/",
  );
}
