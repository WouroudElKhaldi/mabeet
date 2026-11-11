"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { signInUrl } from "@/utils/sign-in-url";

/**
 * The heart that keeps a place on a guest's list. It fills the moment it is tapped and tells the server after,
 * because nobody should wait on a heart; if the server refuses, it goes back to what it was. A signed-out visitor
 * is sent to sign in and comes back to the place they were looking at.
 */
export function FavoriteButton({
  slug,
  saved,
  signedIn,
  onPhoto = false,
}: {
  slug: string;
  saved: boolean;
  /** A visitor who is not signed in has no list yet, so the heart takes them to sign in instead. */
  signedIn: boolean;
  /** On a card's photo the heart needs its own light disc, or a pale picture swallows it. */
  onPhoto?: boolean;
}) {
  const t = useTranslations("place");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, showSaved] = useOptimistic(saved);
  const label = shown ? t("unsave") : t("save");

  const toggle = () => {
    if (!signedIn) {
      router.push(signInUrl(`/p/${slug}`));
      return;
    }
    const next = !shown;
    startTransition(async () => {
      showSaved(next);
      // A refusal (the place is gone, the session ended) leaves the heart as the server has it: when the
      // transition ends, the shown value is dropped and the page's own answer comes back.
      const url = `/api/me/favorites/${slug}`;
      await (next ? api.put(url) : api.delete(url)).catch(() => undefined);
      router.refresh();
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={pending}
      aria-pressed={shown}
      aria-label={label}
      title={label}
      className={onPhoto ? "rounded-full bg-surface/85 shadow-soft hover:bg-surface" : undefined}
    >
      <Heart className={shown ? "size-4 fill-danger text-danger" : "size-4"} aria-hidden />
    </Button>
  );
}
