import clsx from "clsx";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import { ShowAllDialog } from "@/components/ui/show-all-dialog";
import type { PublicPhoto } from "../types";

const MOSAIC_PHOTOS = 5;

function Photo({
  photo,
  fallbackAlt,
  sizes,
  priority = false,
  className,
}: {
  photo: PublicPhoto;
  fallbackAlt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("relative overflow-hidden bg-surface-2", className)}>
      <Image
        src={photo.url}
        alt={photo.alt ?? fallbackAlt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

/**
 * The place's photos: one large and four small on a wide screen, the large one alone on a phone or with fewer than
 * five photos, and "Show all photos" for the rest. A place without photos gets a drawn postcard, never an empty space.
 */
export async function PhotoGallery({ name, photos }: { name: string; photos: readonly PublicPhoto[] }) {
  const t = await getTranslations("placePage");
  const [first, ...rest] = photos;
  if (!first) {
    return (
      <div className="mt-6 aspect-video max-h-96 w-full overflow-hidden rounded-xl ring-1 ring-line">
        <PlaceArt seed={name} className="size-full" />
      </div>
    );
  }
  // The mosaic needs all its small photos: with fewer it would have holes, so the large one stands alone.
  const small = rest.length >= MOSAIC_PHOTOS - 1 ? rest.slice(0, MOSAIC_PHOTOS - 1) : [];
  return (
    <div className="mt-6">
      <div
        className={clsx(
          "grid gap-2 overflow-hidden rounded-xl",
          small.length > 0 && "lg:h-104 lg:grid-cols-4 lg:grid-rows-2",
        )}
      >
        <Photo
          photo={first}
          fallbackAlt={name}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={clsx("aspect-4/3", small.length > 0 && "lg:col-span-2 lg:row-span-2 lg:aspect-auto")}
        />
        {small.map((photo) => (
          <Photo key={photo.id} photo={photo} fallbackAlt={name} sizes="25vw" className="hidden lg:block" />
        ))}
      </div>
      {rest.length > 0 ? (
        <div className="mt-3">
          <ShowAllDialog label={t("showAllPhotos")} title={name}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <Photo
                    photo={photo}
                    fallbackAlt={name}
                    sizes="(min-width: 640px) 45vw, 100vw"
                    className="aspect-4/3 rounded-lg"
                  />
                </li>
              ))}
            </ul>
          </ShowAllDialog>
        </div>
      ) : null}
    </div>
  );
}
