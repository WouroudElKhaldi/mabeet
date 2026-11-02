import { describe, expect, it } from "vitest";
import { createPlace, prisma } from "@tests/integration/helpers";
import { getPublicPlace } from "../server";

// A place's public page reads only what any visitor may see, and only for a live place.

describe("a place's public page", () => {
  it("gives the public fields of a live place, and nothing private", async () => {
    const { business } = await createPlace("Beit Al Zaytoun");
    await prisma.business.update({
      where: { id: business.id },
      data: {
        whatsapp: "+96171123456",
        paymentInstructions: "Whish 71 123 456",
        stripeCustomerId: `cus_${business.id}`,
        commissionRateBps: 1800,
      },
    });

    const place = await getPublicPlace(business.slug);
    expect(place).toMatchObject({
      id: business.id,
      name: "Beit Al Zaytoun",
      slug: business.slug,
      whatsapp: "+96171123456",
      currency: "USD",
      bookingUnit: "ROOMS",
    });
    // Private to the host and the platform: never on the public page.
    for (const field of [
      "paymentInstructions",
      "commissionRateBps",
      "plan",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "onlineTermsAcceptedAt",
      "status",
      "isDeleted",
    ]) {
      expect(place).not.toHaveProperty(field);
    }
  });

  it("is null for an unknown, paused or deleted place, but not for an unlisted one", async () => {
    expect(await getPublicPlace("no-such-place")).toBeNull();

    const paused = await createPlace();
    await prisma.business.update({ where: { id: paused.business.id }, data: { status: "SUSPENDED" } });
    expect(await getPublicPlace(paused.business.slug)).toBeNull();

    const deleted = await createPlace();
    await prisma.business.update({ where: { id: deleted.business.id }, data: { isDeleted: true } });
    expect(await getPublicPlace(deleted.business.slug)).toBeNull();

    // Its link is shared on Instagram: an unlisted place keeps its page, only search leaves it out.
    const unlisted = await createPlace();
    await prisma.business.update({ where: { id: unlisted.business.id }, data: { listedPublicly: false } });
    expect(await getPublicPlace(unlisted.business.slug)).toMatchObject({ id: unlisted.business.id });
  });
});
