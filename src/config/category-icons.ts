import {
  House,
  type LucideIcon,
  Mountain,
  MountainSnow,
  Castle,
  Grape,
  Tent,
  TreePine,
  Waves,
  Wheat,
} from "lucide-react";

// The icons an admin can give a browse category. The stored name is the key; anything else shows a house.

const CATEGORY_ICONS = {
  mountain: Mountain,
  beach: Waves,
  countryside: Wheat,
  "old-town": Castle,
  guesthouse: House,
  cabin: TreePine,
  camping: Tent,
  vineyard: Grape,
  ski: MountainSnow,
} as const satisfies Record<string, LucideIcon>;

type CategoryIconName = keyof typeof CATEGORY_ICONS;

/** The icon names an admin can choose, in the order the picker shows them. */
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as [CategoryIconName, ...CategoryIconName[]];

/** A category's icon by its stored name, or a house for a name we do not know. */
export function categoryIcon(name: string): LucideIcon {
  return Object.hasOwn(CATEGORY_ICONS, name) ? CATEGORY_ICONS[name as CategoryIconName] : House;
}
