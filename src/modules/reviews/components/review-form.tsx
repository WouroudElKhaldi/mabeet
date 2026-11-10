"use client";

import { CircleCheck, LoaderCircle, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";
import { MAX_RATING, MIN_RATING } from "../rating";

/**
 * The review a guest writes after their stay: stars, then what the next guest should know. The stars are real
 * radio buttons, so a keyboard moves between them and a screen reader reads "4 out of 5"; the drawn star is their
 * label. Once it is in, the button gives way to a thank-you rather than inviting a second one.
 */
export function ReviewForm({ token, placeName }: { token: string; placeName: string }) {
  const t = useTranslations("reviews");
  const form = useTranslations("account.review");
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = String(new FormData(event.currentTarget).get("comment") ?? "");
    if (await run(() => api.post(`/api/public/bookings/${token}/review`, { rating, comment }))) {
      setDone(true);
      setOpen(false);
    }
  };

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-success">
        <CircleCheck className="size-4" aria-hidden />
        {t("done")}
      </p>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("write")}
      </Button>
      <SheetDialog open={open} onClose={() => setOpen(false)} title={form("title")} compact>
        <form onSubmit={submit} className="grid gap-5 p-5 sm:p-6">
          <p className="text-sm text-muted">{placeName}</p>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">
              {form("stars", { count: rating || MAX_RATING })}
            </legend>
            <div className="flex gap-1">
              {Array.from({ length: MAX_RATING }, (_, index) => index + MIN_RATING).map((star) => (
                <label key={star} className="cursor-pointer p-1 text-accent">
                  <input
                    type="radio"
                    name="rating"
                    value={star}
                    checked={rating === star}
                    onChange={() => setRating(star)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{form("stars", { count: star })}</span>
                  <Star
                    aria-hidden
                    className="size-8 rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ink"
                    fill={star <= rating ? "currentColor" : "none"}
                    strokeWidth={1.8}
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-muted">{form("scale")}</p>
          </fieldset>
          <TextArea
            label={form("comment")}
            name="comment"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder={form("placeholder")}
          />
          <FormError message={error} />
          <Button
            type="submit"
            size="lg"
            disabled={pending || rating === 0}
            className={`w-full ${slideParent}`}
          >
            <SlideLabel icon={pending ? LoaderCircle : Star} spinning={pending}>
              {pending ? t("sending") : form("submit")}
            </SlideLabel>
          </Button>
        </form>
      </SheetDialog>
    </>
  );
}
