"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** A value to paste somewhere else (an address, a link, a key) with a copy button that says when it worked. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex w-full max-w-full min-w-0 items-center gap-2 rounded-md bg-surface-2 p-1.5 ps-3">
      {/* Addresses read left to right, even on an Arabic page. */}
      <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm bg-surface px-3 text-xs font-semibold ring-1 ring-line transition-colors hover:bg-paper"
      >
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
      </button>
    </div>
  );
}
