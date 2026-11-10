import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, PLACES, signedIn, watchForErrors } from "./helpers";

// Featured partners (F23), from both sides: the admin adds a partner, sponsors it and takes it off; a guest sees the
// partners of the place's region under "Things to do near your stay", sponsored ones first and marked. The partner a
// test adds is removed at its end, so the demo shows only the seeded ones.

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = watchForErrors(page);
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

/** Today as an ISO day (UTC, like the sponsored days). */
const today = () => new Date().toISOString().slice(0, 10);

test.describe("as the admin", () => {
  test.use({ storageState: signedIn("admin") });

  test("adds a partner, sponsors it, then removes it and brings it back", async ({ page, browser }) => {
    const name = `Rooftop Bar ${Date.now() % 100_000}`;
    await page.goto("/admin/partners");
    const added = page.locator("details").filter({ has: page.getByText("New partner", { exact: true }) });
    await added.locator("summary").click();
    await added.getByLabel("Name").fill(name);
    await added.getByLabel("Type").selectOption({ label: "Café" });
    await added.getByLabel("Region").selectOption({ label: "North Lebanon" });
    await added.getByLabel("Town or area").fill("Batroun");
    // A plain http link is refused and named under its field.
    await added.getByLabel("Website or social page").fill("http://example.com");
    await added.getByRole("button", { name: "Add partner" }).click();
    await expect(added.getByText("Use a full link that starts with https://")).toBeVisible();
    await added.getByLabel("Website or social page").fill("https://www.instagram.com/rooftopbar");
    await added.getByRole("button", { name: "Add partner" }).click();

    const panel = page.locator("details").filter({ has: page.getByText(name, { exact: true }) });
    await expect(panel).toBeVisible();
    await panel.locator("summary").click();
    await panel.getByLabel("First day").fill(today());
    await panel.getByLabel("Last day").fill(today());
    await panel.getByRole("button", { name: "Sponsor" }).click();
    await expect(panel.locator("summary")).toContainText("Sponsored now");

    // A guest staying in the north sees it, marked.
    const guest = await browser.newPage();
    await guest.goto(`/p/${PLACES.automatic.slug}`);
    const nearby = guest.getByRole("region", { name: "Things to do near your stay" });
    const card = nearby.getByRole("article").filter({ hasText: name });
    await expect(card.getByText("Sponsored", { exact: true })).toBeVisible();
    // A social page is named for what it is.
    await expect(card.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/rooftopbar",
    );

    await panel.getByRole("button", { name: "End sponsorship" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "End sponsorship" }).click();
    await expect(panel.getByText("Not sponsored.")).toBeVisible();

    await panel.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    const removed = page.getByRole("region", { name: "Removed partners" }).getByRole("listitem").filter({
      hasText: name,
    });
    await expect(removed).toBeVisible();
    await guest.reload();
    await expect(nearby.getByText(name)).toBeHidden();

    await removed.getByRole("button", { name: "Bring back" }).click();
    await expect(panel).toBeVisible();
    await panel.locator("summary").click();
    await panel.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(removed).toBeVisible();
    await expectNoSidewaysScroll(page);
    await guest.close();
  });
});

test("a guest sees the region's partners near the stay, sponsored ones first, on a phone", async ({
  page,
}) => {
  await page.goto(`/p/${PLACES.approval.slug}`);
  const nearby = page.getByRole("region", { name: "Things to do near your stay" });
  await nearby.scrollIntoViewIfNeeded();
  const cards = nearby.getByRole("article");
  await expect(cards.first()).toContainText("Sponsored");
  await expect(cards.filter({ hasText: "Sponsored" })).toHaveCount(1);
  // Partners of other regions are not near this stay.
  await expect(nearby.getByText("Valley Winery (demo)")).toBeHidden();
  await expectNoSidewaysScroll(page);
});
