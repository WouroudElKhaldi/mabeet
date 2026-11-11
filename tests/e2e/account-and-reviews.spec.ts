import { expect } from "@playwright/test";
import {
  expectNoSidewaysScroll,
  newContext,
  placeDashboard,
  PLACES,
  signedIn,
  test,
  watchForErrors,
} from "./helpers";

// A guest's saved places and their Activity page (F5, the account), and the host answering and hiding a review
// (the reviews page). Each test puts back what it changed, so the demo keeps its seeded review as it was.

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

test.describe("as a guest", () => {
  test.use({ storageState: signedIn("guest") });

  test("saves a place, finds it in Saved places and on Activity, then removes it", async ({ page }) => {
    await page.goto(`/p/${PLACES.automatic.slug}`);
    const save = page.getByRole("button", { name: "Save", exact: true });
    const unsave = page.getByRole("button", { name: "Remove from favourites" });
    // The heart changes at once; the server's answer is what the other pages read.
    const tap = async (button: typeof save) => {
      const saved = page.waitForResponse((response) => response.url().includes("/api/me/favorites/"));
      await button.click();
      expect((await saved).ok()).toBe(true);
    };
    // A run stopped half-way may have left it saved.
    if (await unsave.isVisible()) {
      await tap(unsave);
      await expect(save).toBeVisible();
    }
    await tap(save);
    await expect(unsave).toBeVisible();

    await page.goto("/account/favorites");
    await expect(
      page.getByRole("link", { name: new RegExp(PLACES.automatic.name.replace(/[()]/g, "\\$&")) }).first(),
    ).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.goto("/account/activity");
    await expect(page.getByText(`You saved ${PLACES.automatic.name}`).first()).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.goto(`/p/${PLACES.automatic.slug}`);
    await tap(unsave);
    await expect(save).toBeVisible();
    await page.goto("/account/activity");
    await expect(
      page.getByText(`You removed ${PLACES.automatic.name} from your saved places`).first(),
    ).toBeVisible();
  });
});

test.describe("as the host", () => {
  test.use({ storageState: signedIn("host") });

  test("answers a review in public, hides it with a reason, and shows it again", async ({
    page,
    browser,
  }) => {
    // Two windows, the host's and a visitor's, each loading pages in turn.
    test.slow();
    const reply = `Thank you, see you next summer (${Date.now() % 100_000})`;
    const base = await placeDashboard(page, PLACES.offline.name);
    await page.goto(`${base}/reviews`);
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible();
    const review = page.locator("li").filter({ hasText: "A quiet stone house by the sea" });
    await expect(review).toBeVisible();

    // A run stopped half-way may have left an answer, so the button may already say "Update reply": wait for the save.
    const saveReply = async () => {
      const saved = page.waitForResponse((response) => response.url().endsWith("/reply"));
      await review.getByRole("button", { name: /^(Reply|Update reply)$/ }).click();
      expect((await saved).ok()).toBe(true);
    };
    // A run stopped half-way may have left it hidden.
    const showAgain = review.getByRole("button", { name: "Show again" });
    if (await showAgain.isVisible()) {
      await showAgain.click();
      await expect(review.getByRole("button", { name: "Hide" })).toBeVisible();
    }
    await review.getByLabel("Reply").fill(reply);
    await saveReply();
    await expect(review.getByRole("button", { name: "Update reply" })).toBeVisible();

    // Guests see the review and the answer on the place's page.
    const visitor = await newContext(browser);
    const guestView = await visitor.newPage();
    await guestView.goto(`/p/${PLACES.offline.slug}`);
    await expect(guestView.getByText("A quiet stone house by the sea")).toBeVisible();
    await expect(guestView.getByText(reply)).toBeVisible();

    await review.getByRole("button", { name: "Hide" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Testing that hiding works");
    await dialog.getByRole("button", { name: "Hide" }).click();
    await expect(review.getByText("Hidden: Testing that hiding works")).toBeVisible();
    await guestView.reload();
    await expect(guestView.getByText("A quiet stone house by the sea")).toHaveCount(0);

    await review.getByRole("button", { name: "Show again" }).click();
    await expect(review.getByRole("button", { name: "Hide" })).toBeVisible();
    // The answer emptied is taken away, as the demo had it.
    await review.getByLabel("Reply").fill("");
    await saveReply();
    await expect(review.getByRole("button", { name: "Reply", exact: true })).toBeVisible();
    await guestView.reload();
    await expect(guestView.getByText("A quiet stone house by the sea")).toBeVisible();
    await expect(guestView.getByText(reply)).toHaveCount(0);
    await visitor.close();
    await expectNoSidewaysScroll(page);
  });
});
