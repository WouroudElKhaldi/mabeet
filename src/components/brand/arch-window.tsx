import { clsx } from "clsx";
import Image from "next/image";
import { PlaceArt } from "@/components/brand/place-art";
import { stagger } from "@/utils/motion";

interface ArchPhoto {
  url: string;
  alt?: string | null;
}

/**
 * The Lebanese triple-arch window (qantara): three arched panes, the middle one taller.
 * Each pane shows a photo, or generated art while a place has none.
 */
export function ArchWindow({
  photos,
  seed,
  className,
  priority = false,
}: {
  photos: Array<ArchPhoto | null>;
  seed: string;
  className?: string;
  priority?: boolean;
}) {
  const panes = Array.from({ length: 3 }, (_, index) => photos[index] ?? null);
  return (
    <div className={clsx("grid grid-cols-[1fr_1.25fr_1fr] items-end gap-3", className)} aria-hidden>
      {panes.map((photo, index) => (
        <div
          key={index}
          className={clsx(
            "rise-in relative overflow-hidden bg-surface-2 ring-4 ring-paper",
            index === 1 ? "arch-tall aspect-[3/5]" : "arch aspect-[3/4]",
          )}
          style={stagger(index + 1)}
        >
          {photo ? (
            <Image
              src={photo.url}
              alt=""
              fill
              priority={priority && index === 1}
              sizes="(min-width: 1024px) 18vw, 33vw"
              className="object-cover"
            />
          ) : (
            <PlaceArt seed={`${seed}-${index}`} className="size-full" />
          )}
        </div>
      ))}
    </div>
  );
}
