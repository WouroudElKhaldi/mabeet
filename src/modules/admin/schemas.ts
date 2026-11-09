import { z } from "zod";
import { PALETTES } from "@/config/appearance";
import { CATEGORY_ICON_NAMES } from "@/config/category-icons";
import { LISTING_KINDS } from "@/config/enums";

/** The website's colour palette, chosen by a platform admin. */
export const sitePaletteInput = z.object({ palette: z.enum(PALETTES) });

const categoryFields = z.object({
  nameEn: z.string().trim().min(2).max(40),
  nameAr: z.string().trim().min(2).max(40),
  icon: z.enum(CATEGORY_ICON_NAMES),
  position: z.number().int().min(0).max(999),
});

/** A new browse category. Its slug is its key and its kind never changes, so both are set only here. */
export const categoryInput = categoryFields.extend({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .max(40),
  kind: z.enum(LISTING_KINDS),
});
export const categoryUpdate = categoryFields.partial();
export const categoryParams = z.object({ slug: z.string().min(1).max(40) });
