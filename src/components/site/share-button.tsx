"use client";

import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shares the page a guest is on: the phone's own share sheet where there is one, otherwise the link is copied. Both
 * can be refused (the guest closes the sheet, or the browser keeps the clipboard shut), and then nothing is claimed.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      // The guest closing the sheet rejects this; it is not a failure, and leaves nothing to say.
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // An old browser, or one that keeps the clipboard shut: the guest can still copy from the address bar.
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={share} className={className}>
      {copied ? (
        <Check className="size-4 text-success" aria-hidden />
      ) : (
        <Share2 className="size-4" aria-hidden />
      )}
      <span aria-live="polite">{copied ? t("copied") : t("button")}</span>
    </Button>
  );
}
