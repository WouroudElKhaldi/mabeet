"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { SheetDialog } from "./sheet-dialog";

/** "Show all photos / reviews / amenities": a button that opens everything in a large dialog. */
export function ShowAllDialog({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SheetDialog open={open} onClose={() => setOpen(false)} title={title} size="lg">
        {children}
      </SheetDialog>
    </>
  );
}
