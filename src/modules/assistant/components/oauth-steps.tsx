"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// The two screens between signing in and an AI app getting its token. The signed OAuth request rides along in this
// page's address; authClient's oauthProviderClient plugin sends it with each step.

type OAuthStepResult = { data: unknown; error: { message?: string } | null };

/**
 * Runs one OAuth step and follows the address Better Auth answers with (`url`, or `uri` on consent). It is followed
 * as is, not through useRedirectAction: an AI app's own callback is often http://localhost, and Better Auth has
 * already checked it against the addresses the app registered.
 */
function useOAuthStep() {
  const t = useTranslations("oauth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(step: () => Promise<OAuthStepResult>): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await step();
      const next = result.data as { url?: string; uri?: string } | null;
      const url = next?.url ?? next?.uri;
      if (result.error || !url) throw new Error(result.error?.message);
      window.location.assign(url);
    } catch (caught) {
      setError(errorMessage(caught, t("failed")));
      setPending(false);
    }
  }

  return { run, pending, error };
}

/** Which of the person's places the AI app may work in. */
export function WorkspacePicker({
  workspaces,
}: {
  workspaces: Array<{ id: string; name: string; role: string }>;
}) {
  const t = useTranslations("oauth");
  const [picked, setPicked] = useState(workspaces[0]?.id ?? "");
  const { run, pending, error } = useOAuthStep();

  const next = () =>
    run(async () => {
      await api.post("/api/oauth/workspace", { businessId: picked });
      return authClient.oauth2.continue({ postLogin: true });
    });

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t("workspaceTitle")}</legend>
        {workspaces.map((workspace) => (
          <label
            key={workspace.id}
            className={clsx(
              "flex cursor-pointer items-center justify-between gap-3 rounded-xl p-4 ring-1 transition-colors",
              picked === workspace.id
                ? "bg-surface-2 ring-2 ring-accent"
                : "ring-line-strong hover:bg-surface-2",
            )}
          >
            <span className="min-w-0">
              <span className="block font-semibold">{workspace.name}</span>
              <span className="text-sm text-muted">{workspace.role}</span>
            </span>
            <input
              type="radio"
              name="workspace"
              value={workspace.id}
              checked={picked === workspace.id}
              onChange={() => setPicked(workspace.id)}
              className="size-4 accent-accent"
            />
          </label>
        ))}
      </fieldset>
      <Button size="lg" disabled={!picked || pending} onClick={() => void next()}>
        {t("continue")}
      </Button>
      <FormError message={error} />
    </div>
  );
}

/** Allow or refuse: either way the person goes back to the AI app, which learns the answer. */
export function ConsentButtons() {
  const t = useTranslations("oauth");
  const { run, pending, error } = useOAuthStep();
  return (
    <div className="grid gap-3">
      <Button
        size="lg"
        disabled={pending}
        onClick={() => void run(() => authClient.oauth2.consent({ accept: true }))}
      >
        {t("allow")}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        disabled={pending}
        onClick={() => void run(() => authClient.oauth2.consent({ accept: false }))}
      >
        {t("deny")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
