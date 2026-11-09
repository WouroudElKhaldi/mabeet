import type { PhotoArea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { countPhotos, groupPhotos } from "../photo-groups";
import type { PublicPhoto, PublicUnit } from "../types";

// How the photo tour is ordered: the place's own photos by part of the house, then each room with photos.

const photo = (id: string, area: PhotoArea | null = null): PublicPhoto => ({
  id,
  url: `/p/${id}.jpg`,
  alt: null,
  area,
});

const unit = (id: string, name: string, photos: PublicPhoto[]): PublicUnit => ({
  id,
  name,
  description: null,
  capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  baseRateCents: 9000,
  minNights: 1,
  amenities: [],
  photos,
});

describe("grouping a place's photos", () => {
  it("puts the parts of the house in the list's order, whatever order the photos came in", () => {
    const groups = groupPhotos([photo("a", "POOL"), photo("b", "KITCHEN"), photo("c", "LIVING_ROOM")], []);
    expect(groups.map((group) => (group.kind === "area" ? group.area : group.name))).toEqual([
      "LIVING_ROOM",
      "KITCHEN",
      "POOL",
    ]);
  });

  it("keeps several photos of one part together, in the order the host put them", () => {
    const groups = groupPhotos([photo("a", "BEDROOM"), photo("b", "KITCHEN"), photo("c", "BEDROOM")], []);
    expect(groups[1]).toMatchObject({ kind: "area", area: "BEDROOM" });
    expect(groups[1]?.photos.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("shows photos the host never placed last, under the additional ones", () => {
    const groups = groupPhotos([photo("a"), photo("b", "GARDEN")], []);
    expect(groups.map((group) => (group.kind === "area" ? group.area : group.name))).toEqual([
      "GARDEN",
      "OTHER",
    ]);
  });

  it("puts them with the ones the host did place there", () => {
    const groups = groupPhotos([photo("a", "OTHER"), photo("b")], []);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.photos.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("adds each room after the house, in the order the rooms are given", () => {
    const groups = groupPhotos(
      [photo("a", "EXTERIOR")],
      [unit("r1", "Cedar room", [photo("r1a")]), unit("r2", "Valley room", [photo("r2a")])],
    );
    expect(groups.map((group) => (group.kind === "area" ? group.area : group.name))).toEqual([
      "EXTERIOR",
      "Cedar room",
      "Valley room",
    ]);
  });

  it("leaves out a room with no photos, so no heading stands over nothing", () => {
    const groups = groupPhotos([], [unit("r1", "Cedar room", []), unit("r2", "Valley room", [photo("r2a")])]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "room", name: "Valley room" });
  });

  it("has nothing to group for a place with no photos at all", () => {
    expect(groupPhotos([], [unit("r1", "Cedar room", [])])).toEqual([]);
  });
});

describe("counting the photos of a tour", () => {
  it("counts every photo under every heading", () => {
    const groups = groupPhotos(
      [photo("a", "POOL"), photo("b")],
      [unit("r1", "Cedar room", [photo("r1a"), photo("r1b")])],
    );
    expect(countPhotos(groups)).toBe(4);
  });

  it("is 0 when there are none", () => {
    expect(countPhotos([])).toBe(0);
  });
});
