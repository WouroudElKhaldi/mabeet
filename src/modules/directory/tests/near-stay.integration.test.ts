import { describe, expect, it } from "vitest";
import { createPlace, prisma } from "@tests/integration/helpers";
import { listNearStay } from "../server";

// What a guest's booking page shows near their stay: the partners of the place's region, and nothing for a place
// that has closed since.

async function placeInRegion(region: string) {
  const place = await createPlace("Beit Near");
  await prisma.business.update({
    where: { id: place.business.id },
    data: { region, latitude: 34.25, longitude: 35.65 },
  });
  return place;
}

describe("near a booked stay", () => {
  it("shows the partners of the place's region, nearest first", async () => {
    const region = `test-region-${crypto.randomUUID()}`;
    const place = await placeInRegion(region);
    await prisma.partnerPlace.createMany({
      data: [
        { name: "Far bakery", kind: "RESTAURANT", region, latitude: 34.4, longitude: 35.8 },
        { name: "Near cafe", kind: "RESTAURANT", region, latitude: 34.251, longitude: 35.651 },
      ],
    });

    expect((await listNearStay(place.business.slug)).map((partner) => partner.name)).toEqual([
      "Near cafe",
      "Far bakery",
    ]);
  });

  it("shows nothing once the place has closed", async () => {
    const region = `test-region-${crypto.randomUUID()}`;
    const place = await placeInRegion(region);
    await prisma.partnerPlace.create({ data: { name: "Cafe", kind: "RESTAURANT", region } });
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });

    expect(await listNearStay(place.business.slug)).toEqual([]);
  });
});
