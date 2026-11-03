import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// The browser's side of sign-in. locale is set at sign-up from the language the person is using, so their emails
// come in it. oauthProviderClient carries an AI app's signed OAuth request through sign-in, the choice of a place
// and consent.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({ user: { locale: { type: "string", required: false } } }),
    oauthProviderClient(),
  ],
});

/**
 * Ends the session and reloads the home page. A full load, not a client-side redirect, so nothing from the
 * signed-in session (cached pages, open dialogs, the notification feed) survives into the next visit.
 */
export async function signOutAndLeave(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    window.location.assign("/");
  }
}
