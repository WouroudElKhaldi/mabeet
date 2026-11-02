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
  /** `start`: a drawer from the start side (the left, or the right in Arabic), for a menu on phones. */
  placement?: "center" | "start";
}

// The native <dialog>: the browser keeps the focus inside, closes it on Esc, and makes the page behind it inert.
// Put `data-autofocus` on the element that should have the focus first (the first button, by default).
// Each layout is written out whole: two width classes on one element would fight, and the one that wins would depend
// on the order of the generated CSS.
const base = "border-0 bg-surface p-0 text-ink shadow-lift backdrop:bg-scrim";
const sheetBySize = {
  md: "m-auto w-full sm:max-w-lg sm:rounded-xl sm:max-h-[85dvh] max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-dvw max-sm:max-w-none max-sm:rounded-none",
  lg: "m-auto w-full sm:max-w-3xl sm:rounded-xl sm:max-h-[85dvh] max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-dvw max-sm:max-w-none max-sm:rounded-none",
};
const compactBox = "m-auto w-full max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md sm:max-h-[85dvh]";
const drawer = "m-0 me-auto h-dvh max-h-none w-[86%] max-w-80 rounded-none";

function dialogClasses(placement: "center" | "start", compact: boolean, size: "md" | "lg") {
  if (placement === "start") return `${base} ${drawer}`;
  return `${base} ${compact ? compactBox : sheetBySize[size]}`;
}

function panelClasses(placement: "center" | "start", compact: boolean) {
  if (placement === "start") return "h-dvh";
  return compact ? "max-h-[85dvh]" : "h-dvh sm:h-auto sm:max-h-[85dvh]";
}

/** A dialog that is a full-screen sheet on phones and a centred box on bigger screens. */
export function SheetDialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  compact = false,
  placement = "center",
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
      className={dialogClasses(placement, compact, size)}
    >
      {open ? (
        <div className={`rise-in flex flex-col ${panelClasses(placement, compact)}`}>
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
