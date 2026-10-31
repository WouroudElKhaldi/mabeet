// Booking needs an account, so a signed-out guest is sent to sign in and then back to the booking they started.
// Only a path on this site is ever followed, so the link cannot send anyone to another website.

const AFTER_SIGN_IN = "/home";

/** The page to open after signing in: `next` when it is a path on this site, otherwise /home. */
export function afterSignIn(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : AFTER_SIGN_IN;
}

/** The sign-in page, coming back to `next` afterwards. */
export function signInUrl(next: string): string {
  return `/sign-in?next=${encodeURIComponent(afterSignIn(next))}`;
}
