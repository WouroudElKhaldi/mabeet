import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, createUser, memberWith, prisma } from "@tests/integration/helpers";
import { getPlatformPerson, listPlatformPeople } from "../server";

// The admin's people table: the newest first, searched and filtered by kind, a page at a time, and one person's
// page with the places they work in.

describe("the people on the platform", () => {
  it("lists the newest accounts with the places they work in", async () => {
    const place = await createPlace();
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const admin = await createPlatformAdmin();
    const { total, people } = await listPlatformPeople(admin);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(people.find((person) => person.id === admin.userId)?.platformRole).toBe("SUPER_ADMIN");
    expect(people.find((person) => person.id === staff.userId)).toMatchObject({
      placeCount: 1,
      ownsPlace: false,
      tripCount: 0,
    });
  });

  it("finds people by name or email, tells hosts, teams, guests and admins apart, and pages", async () => {
    const admin = await createPlatformAdmin();
    const word = randomUUID().slice(0, 8);
    const place = await createPlace(`Beit ${word}`);
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    await prisma.user.update({ where: { id: staff.userId }, data: { name: `Staff ${word}` } });
    const guest = await createUser(`Guest ${word}`);
    const ids = async (kind?: "guest" | "team" | "host" | "admin") =>
      (await listPlatformPeople(admin, { q: word, kind })).people.map((person) => person.id);

    expect(new Set(await ids())).toEqual(new Set([place.owner.id, staff.userId, guest.id]));
    expect(await ids("host")).toEqual([place.owner.id]);
    expect(await ids("team")).toEqual([staff.userId]);
    expect(await ids("guest")).toEqual([guest.id]);
    expect(await ids("admin")).toEqual([]);
    expect((await listPlatformPeople(admin, { q: guest.email.toUpperCase() })).people).toHaveLength(1);

    const firstPage = await listPlatformPeople(admin, { q: "" }, 1);
    expect(firstPage.people.length).toBeLessThanOrEqual(20);
    expect(firstPage.pages).toBe(Math.max(1, Math.ceil(firstPage.total / 20)));
  });

  it("shows one person with their places and role, and 404 for no such person", async () => {
    const admin = await createPlatformAdmin();
    const place = await createPlace();
    const person = await getPlatformPerson(admin, place.owner.id);
    expect(person).toMatchObject({ id: place.owner.id, tripCount: 0, reviewCount: 0 });
    expect(person.places).toEqual([expect.objectContaining({ id: place.business.id, isOwner: true })]);
    await expect(getPlatformPerson(admin, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
