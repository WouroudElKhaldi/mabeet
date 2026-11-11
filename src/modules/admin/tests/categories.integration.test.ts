import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import {
  createCategory,
  deleteCategory,
  listCategoriesForAdmin,
  listCategoryPage,
  updateCategory,
} from "../server";

// Browse categories: a slug is created once (a deleted one comes back instead of a copy), and a category still in use
// cannot be deleted, so no place silently loses it.

const newCategory = (slug: string) => ({
  slug,
  kind: "HOME" as const,
  nameEn: "Riverside",
  nameAr: "على النهر",
  icon: "countryside" as const,
  position: 5,
});

const freshSlug = () => `test-${randomUUID().slice(0, 8)}`;

describe("browse categories", () => {
  it("refuses a second category with the same slug, and brings a deleted one back", async () => {
    const admin = await createPlatformAdmin();
    const slug = freshSlug();
    await createCategory(admin, newCategory(slug));
    await expect(createCategory(admin, newCategory(slug))).rejects.toMatchObject({ code: "CONFLICT" });

    await deleteCategory(admin, slug);
    await createCategory(admin, { ...newCategory(slug), nameEn: "By the river" });
    expect(await prisma.category.count({ where: { slug } })).toBe(1);
    expect((await listCategoriesForAdmin(admin)).find((category) => category.slug === slug)).toMatchObject({
      nameEn: "By the river",
    });
  });

  it("keeps a category a place still uses", async () => {
    const admin = await createPlatformAdmin();
    const slug = freshSlug();
    await createCategory(admin, newCategory(slug));
    const place = await createPlace();
    await prisma.businessCategory.create({ data: { businessId: place.business.id, categorySlug: slug } });
    await expect(deleteCategory(admin, slug)).rejects.toMatchObject({ code: "CONFLICT" });
    await updateCategory(admin, slug, { position: 1 });
    expect(await prisma.category.findUniqueOrThrow({ where: { slug } })).toMatchObject({
      position: 1,
      isDeleted: false,
    });
  });
});

describe("the admin's categories table", () => {
  it("finds categories by slug or name, filters by kind, and pages", async () => {
    const admin = await createPlatformAdmin();
    const word = randomUUID().slice(0, 8);
    await createCategory(admin, { ...newCategory(`home-${word}`), nameEn: `Hills ${word}` });
    await createCategory(admin, { ...newCategory(`trip-${word}`), kind: "EXPERIENCE" });

    const slugs = async (kind?: "HOME" | "EXPERIENCE" | "SERVICE") =>
      (await listCategoryPage(admin, { q: word, kind })).categories.map((category) => category.slug);
    expect(new Set(await slugs())).toEqual(new Set([`home-${word}`, `trip-${word}`]));
    expect(await slugs("EXPERIENCE")).toEqual([`trip-${word}`]);
    expect(await slugs("SERVICE")).toEqual([]);
    expect((await listCategoryPage(admin, { q: `HILLS ${word}` })).categories).toEqual([
      expect.objectContaining({ slug: `home-${word}`, uses: 0 }),
    ]);
    expect(await listCategoryPage(admin, { q: word }, 5)).toMatchObject({ total: 2, page: 1, pages: 1 });
  });
});
