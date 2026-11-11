"use client";

import { type LucideIcon, Plus } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Button, type ButtonVariant } from "./button";
import { SheetDialog } from "./sheet-dialog";

/** Closes the dialog the form is in; does nothing for a form shown on a page. */
const CloseDialog = createContext<() => void>(() => undefined);

/** For a form that may sit in a `FormDialog`: call it once it has saved. */
export function useCloseDialog() {
  return useContext(CloseDialog);
}

/**
 * Adding or changing something (a room, a category, a team member, an offer): a button that opens the form in a
 * pop-up in the middle of the screen, so the page stays the list it is and never grows a form at its end. The form is
 * made fresh each time the pop-up opens, and closes it with `useCloseDialog()` once it has saved.
 */
export function FormDialog({
  label,
  title,
  intro,
  icon: Icon = Plus,
  size = "md",
  variant = "primary",
  children,
}: {
  /** The button's text: "Add a room", "Edit". */
  label: string;
  /** The button's icon: a plus by default, for adding. */
  icon?: LucideIcon;
  title: string;
  intro?: string;
  size?: "md" | "lg";
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Icon className="size-4" aria-hidden />
        {label}
      </Button>
      <SheetDialog open={open} onClose={close} title={title} size={size}>
        {open ? (
          <CloseDialog.Provider value={close}>
            {intro ? <p className="mb-4 text-sm text-muted">{intro}</p> : null}
            {children}
          </CloseDialog.Provider>
        ) : null}
      </SheetDialog>
    </>
  );
}
