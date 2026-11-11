import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import type { PhotoGroup } from "../photo-groups";

/**
 * Every photo of a place, under the part of the house or the room it shows. Photos are tall and in one column on a
 * phone, two on a wide screen, so each one is worth looking at rather than a thumbnail.
 */
export async function PhotoTour({ name, groups }: { name: string; groups: readonly PhotoGroup[] }) {
  const t = await getTranslations("photoTour");
  if (groups.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 py-10">
        <PlaceArt seed={name} className="h-48 w-full max-w-sm rounded-xl" />
        <p className="text-muted">{t("none")}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-12">
      {groups.map((group) => (
        <section key={group.id} className="grid gap-4">
          <h2 className="text-xl font-semibold">
            {group.kind === "area" ? t(`areas.${group.area}`) : group.name}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {group.photos.map((photo) => (
              <li key={photo.id} className="relative aspect-4/3 overflow-hidden rounded-xl bg-surface-2">
                <Image
                  src={photo.url}
                  alt={photo.alt ?? name}
                  fill
                  sizes="(min-width: 640px) 45vw, 100vw"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
