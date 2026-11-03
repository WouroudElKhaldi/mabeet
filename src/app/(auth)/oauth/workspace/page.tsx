import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkspacePicker } from "@/modules/assistant";
import { listConnectableWorkspaces } from "@/modules/assistant/server";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("oauth");
  return { title: t("workspaceTitle"), robots: { index: false } };
}

/** Step 2 of connecting an AI app: which place it may work in. */
export default async function OAuthWorkspacePage() {
  const user = await requirePageUser();
  const [t, workspaces] = await Promise.all([getTranslations("oauth"), listConnectableWorkspaces(user.id)]);
  return (
    <>
      <p className="rise-in text-xs font-bold tracking-[0.16em] text-accent uppercase">{t("kicker")}</p>
      <h1 className="rise-in mt-3 font-poster text-[2rem]">{t("workspaceTitle")}</h1>
      <p className="mt-3 mb-8 text-muted">{t("workspaceBody")}</p>
      {workspaces.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm">{t("noWorkspace")}</p>
      ) : (
        <WorkspacePicker workspaces={workspaces} />
      )}
    </>
  );
}
