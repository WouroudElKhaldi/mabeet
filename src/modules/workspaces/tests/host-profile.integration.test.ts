import { describe, expect, it } from "vitest";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { getHostSection, getMyHostProfile, saveMyHostProfile } from "../server";

// The host profile: owners only, saved once per person whatever place they save it from, and shown to guests only
// while it is turned on. How guests reach the host applies either way.

const profile = {
  displayName: "Rima",
  bio: "I grew up in this house.",
  city: "Batroun",
  languages: ["ar", "fr"] as ("ar" | "fr")[],
  hostingSince: 2019,
  showOnListings: false,
  contactBy: "WHATSAPP" as const,
};

describe("the host profile", () => {
  it("stays private until turned on, and keeps one row per person", async () => {
    const place = await createPlace();
    await saveMyHostProfile(place.ctx, profile);
    expect(await getHostSection(place.business.id)).toEqual({ contactBy: "WHATSAPP", profile: null });

    await saveMyHostProfile(place.ctx, { ...profile, showOnListings: true, city: null });
    expect(await getHostSection(place.business.id)).toMatchObject({
      profile: { name: "Rima", city: null, languages: ["ar", "fr"], hostingSince: 2019 },
    });
    expect(await prisma.hostProfile.count({ where: { userId: place.owner.id } })).toBe(1);
    expect(await getMyHostProfile(place.ctx)).toMatchObject({ showOnListings: true, bio: profile.bio });
  });

  it("is for owners only", async () => {
    const place = await createPlace();
    const staff = await memberWith(place.business.id, ["settings.manage"]);
    await expect(saveMyHostProfile(staff, profile)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getMyHostProfile(staff)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
