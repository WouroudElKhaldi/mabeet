"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./button";

interface SheetDialogProps {
  open: boolean;
  /** Asked for by Esc, a click on the dark layer and the close button. Set `open` to false in answer. */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons under the content, kept in view while the content scrolls. */
  footer?: ReactNode;
  /** `lg` for long content such as all the reviews. */
  size?: "md" | "lg";
  /** A small box on every screen, not a full-screen sheet on phones: for short questions. */
  compact?: boolean;
}

// The native <dialog>: the browser keeps the focus inside, closes it on Esc, and makes the page behind it inert.
// Put `data-autofocus` on the element that should have the focus first (the first button, by default).
const sizeClasses = { md: "sm:max-w-lg", lg: "sm:max-w-3xl" };

/** A dialog that is a full-screen sheet on phones and a centred box on bigger screens. */
export function SheetDialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  compact = false,
}: SheetDialogProps) {
  const t = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // The browser also reports a close we asked for ourselves; only a close the visitor started needs an answer.
      onClose={() => open && onClose()}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={`m-auto w-full border-0 bg-surface p-0 text-ink shadow-lift backdrop:bg-scrim sm:rounded-xl ${
        sizeClasses[compact ? "md" : size]
      } ${
        compact
          ? "max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md"
          : "max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-dvw max-sm:max-w-none max-sm:rounded-none"
      } sm:max-h-[85dvh]`}
    >
      {open ? (
        <div
          className={`rise-in flex flex-col ${compact ? "max-h-[85dvh]" : "h-dvh sm:h-auto sm:max-h-[85dvh]"}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("close")}
              className="-me-2 -mt-1"
              onClick={onClose}
            >
              <X className="size-5" aria-hidden />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
