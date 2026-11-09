import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { createCategory, deleteCategory, listCategoriesForAdmin, updateCategory } from "../server";

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
