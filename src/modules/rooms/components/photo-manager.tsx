"use client";

import { ImagePlus, LoaderCircle, Pin, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { PHOTO_AREAS } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string | null;
  area: string | null;
}

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a photo in the browser before it is sent, so a host on mobile data sends a few hundred KB instead of 8 MB.
 * The server checks and shrinks it again either way.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  return blob ?? file;
}

/** Uploads photos one by one, shrunk first, to the place's gallery or a room's. Says whether all of them went up. */
export async function uploadPhotos(
  businessId: string,
  files: File[],
  roomId: string | null,
  onProgress?: (done: number) => void,
): Promise<boolean> {
  let allUploaded = true;
  for (const [index, file] of files.entries()) {
    const form = new FormData();
    form.set("file", await shrink(file).catch(() => file), file.name);
    if (roomId) form.set("roomId", roomId);
    await api.upload(`/api/workspaces/${businessId}/photos`, form).catch(() => {
      allUploaded = false;
    });
    onProgress?.(index + 1);
  }
  return allUploaded;
}

/**
 * The photos of the place, or of one of its rooms: upload, pick the cover, tag what each shows for the photo tour,
 * and delete (after a confirmation).
 */
export function PhotoManager({
  businessId,
  roomId = null,
  photos,
}: {
  businessId: string;
  roomId?: string | null;
  photos: GalleryPhoto[];
}) {
  const t = useTranslations("dashboard.photos");
  const tArea = useTranslations("photoTour.areas");
  const tConfirm = useTranslations("confirm.deletePhoto");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = pending || progress !== null;
  const photoUrl = (photoId: string) => `/api/workspaces/${businessId}/photos/${photoId}`;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setFailed(false);
    setProgress({ done: 0, total: list.length });
    const allUploaded = await uploadPhotos(businessId, list, roomId, (done) =>
      setProgress({ done, total: list.length }),
    );
    setProgress(null);
    setFailed(!allUploaded);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const remove = async (photoId: string) => {
    const answer = await confirm({
      title: tConfirm("title"),
      body: tConfirm("body"),
      confirmLabel: tConfirm("confirm"),
    });
    if (answer) await run(() => api.delete(photoUrl(photoId)));
  };

  return (
    <section className="grid gap-3">
      {dialog}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t(roomId ? "roomTitle" : "title")}</h2>
          <p className="max-w-xl text-sm text-muted">{t(roomId ? "roomHint" : "hint")}</p>
        </div>
        <label
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 has-focus-visible:ring-2 has-focus-visible:ring-accent ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {progress ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {progress ? t("uploading", progress) : t("upload")}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => void upload(event.target.files)}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="grid gap-1.5">
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                <Image src={photo.url} alt={photo.alt ?? ""} fill sizes="200px" className="object-cover" />
                {index === 0 && (
                  <span className="absolute start-2 top-2 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold shadow-soft">
                    {t("cover")}
                  </span>
                )}
                <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {index > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={t("makeCover")}
                      title={t("makeCover")}
                      onClick={() => void run(() => api.patch(photoUrl(photo.id), { cover: true }))}
                      className="grid size-8 place-items-center rounded-full bg-surface shadow-soft transition-transform hover:scale-105"
                    >
                      <Pin className="size-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t("remove")}
                    title={t("remove")}
                    onClick={() => void remove(photo.id)}
                    className="grid size-8 place-items-center rounded-full bg-surface text-danger shadow-soft transition-transform hover:scale-105"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <select
                aria-label={t("area")}
                value={photo.area ?? ""}
                disabled={busy}
                onChange={(event) =>
                  void run(() => api.patch(photoUrl(photo.id), { area: event.target.value || null }))
                }
                className={`${inputClass} h-9 px-2 text-xs`}
              >
                <option value="">{t("noArea")}</option>
                {PHOTO_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {tArea(area)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      <FormError message={error ?? (failed ? t("failed") : null)} />
    </section>
  );
}
