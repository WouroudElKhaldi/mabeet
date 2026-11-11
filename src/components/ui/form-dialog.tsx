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

/** What the save button of a form in a step-by-step flow says, instead of its own "Save". */
const SubmitLabel = createContext<string | null>(null);

/** For a form that may be one step of a flow: its save button's text, or `fallback` anywhere else. */
export function useSubmitLabel(fallback: string) {
  return useContext(SubmitLabel) ?? fallback;
}

/**
 * A form shown as one step of a flow (the guided setup) rather than in a pop-up: once it has saved, `onSaved` moves
 * on, and its save button says `submitLabel` ("Save and continue"). The same forms work on their pages unchanged.
 */
export function FormStep({
  onSaved,
  submitLabel,
  children,
}: {
  onSaved: () => void;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <CloseDialog.Provider value={onSaved}>
      <SubmitLabel.Provider value={submitLabel}>{children}</SubmitLabel.Provider>
    </CloseDialog.Provider>
  );
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
            {/* A pop-up opened from a step of a flow saves with its own words, not the step's. */}
            <SubmitLabel.Provider value={null}>
              {intro ? <p className="mb-4 text-sm text-muted">{intro}</p> : null}
              {children}
            </SubmitLabel.Provider>
          </CloseDialog.Provider>
        ) : null}
      </SheetDialog>
    </>
  );
}
