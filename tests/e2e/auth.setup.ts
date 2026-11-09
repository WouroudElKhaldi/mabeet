import { expect, test as setup } from "@playwright/test";
import { ACCOUNTS, type AccountName, PASSWORD, signedIn } from "./helpers";

// Signs each demo account in once, through the real sign-in page, and keeps its cookies for the tests that start
// signed in. Better Auth lets 3 sign-ins through every 10 seconds; past that, the page says to wait, and this waits
// out the window as a person would.

const SIGN_IN_WINDOW_MS = 11_000;

for (const account of Object.keys(ACCOUNTS) as AccountName[]) {
  setup(`sign in as ${account}`, async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(ACCOUNTS[account]);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    const tooMany = page.getByText("Too many attempts in a short time");
    const signedInNow = () => !new URL(page.url()).pathname.startsWith("/sign-in");
    for (let attempt = 0; attempt < 3 && !signedInNow(); attempt += 1) {
      await page.getByRole("button", { name: "Sign in" }).click();
      await Promise.race([
        page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 }),
        tooMany.waitFor({ timeout: 15_000 }),
      ]).catch(() => undefined);
      if (!signedInNow()) await page.waitForTimeout(SIGN_IN_WINDOW_MS);
    }
    await expect(page).not.toHaveURL(/\/sign-in/);
    await page.context().storageState({ path: signedIn(account) });
  });
}
