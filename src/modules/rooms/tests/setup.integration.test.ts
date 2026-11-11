import { describe, expect, it } from "vitest";
import { addRoom, createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { updateSettings } from "@/modules/workspaces/server";
import { getSetupChecklist } from "../server";

// The checklist a new place sees on its home page: each step is worked out from what is saved, so it ticks itself as
// the host does it on its own page.

const stepsLeft = async (ctx: Parameters<typeof getSetupChecklist>[0]) =>
  (await getSetupChecklist(ctx)).steps.filter((step) => !step.done).map((step) => step.key);

function addPhotos(businessId: string, count: number) {
  return prisma.photo.createMany({
    data: Array.from({ length: count }, (_, position) => ({
      businessId,
      url: `https://images.example.com/${position}.webp`,
      position,
    })),
  });
}

describe("getting a new place ready", () => {
  it("starts with every step to do, and ticks each one as it is saved", async () => {
    const place = await createPlace();
    expect(await stepsLeft(place.ctx)).toEqual([
      "describe",
      "photos",
      "rooms",
      "booking",
      "contact",
      "publish",
    ]);
    expect(await getSetupChecklist(place.ctx)).toMatchObject({ ready: false, listed: false, photoCount: 0 });

    await updateSettings(place.ctx, { description: "A stone house above the sea.", area: "Batroun" });
    await addPhotos(place.business.id, 4);
    expect(await getSetupChecklist(place.ctx)).toMatchObject({ photoCount: 4 });
    expect(await stepsLeft(place.ctx)).toEqual(["photos", "rooms", "booking", "contact", "publish"]);

    await addPhotos(place.business.id, 1);
    await addRoom(place.business.id);
    await updateSettings(place.ctx, { paymentInstructions: "Whish 03 123 456", whatsapp: "+96170123456" });
    expect(await stepsLeft(place.ctx)).toEqual(["publish"]);
    expect(await getSetupChecklist(place.ctx)).toMatchObject({ ready: true, listed: false });

    await updateSettings(place.ctx, { listedPublicly: true });
    expect(await getSetupChecklist(place.ctx)).toMatchObject({ ready: true, listed: true });
    expect(await stepsLeft(place.ctx)).toEqual([]);
  });

  it("counts the whole place, not rooms, for a place booked as a whole, and a room's photos are not the place's", async () => {
    const place = await createPlace();
    await prisma.business.update({ where: { id: place.business.id }, data: { bookingUnit: "WHOLE_PLACE" } });
    const room = await addRoom(place.business.id);
    await prisma.photo.create({
      data: { businessId: place.business.id, roomId: room.id, url: "https://x.test/a.webp" },
    });
    const checklist = await getSetupChecklist(place.ctx);
    expect(checklist.photoCount).toBe(0);
    expect(checklist.steps.find((step) => step.key === "rooms")).toMatchObject({ done: false });

    await addRoom(place.business.id, { kind: "WHOLE_PLACE" });
    expect(await stepsLeft(place.ctx)).not.toContain("rooms");
  });

  it("is for the people who run the place", async () => {
    const place = await createPlace();
    const frontDesk = await memberWith(place.business.id, ["bookings.read", "calendar.read"]);
    await expect(getSetupChecklist(frontDesk)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
