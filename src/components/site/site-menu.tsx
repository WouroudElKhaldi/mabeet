"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { NavGroup } from "@/components/shell/nav";
import { NavLinks } from "@/components/shell/nav-links";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";

/**
 * The site header's pages on a phone, a tablet or a small laptop (below xl), where the header has no room for them: a
 * menu button opening a drawer from the start side with the same pages, and light/dark and the language, which leave
 * the header to make that room.
 */
export function SiteMenu({ nav, title }: { nav: NavGroup[]; title: string }) {
  const t = useTranslations("shell");
  const appearance = useTranslations("appearance");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="xl:hidden"
        aria-label={t("menu")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" aria-hidden />
      </Button>
      <SheetDialog placement="start" open={open} onClose={() => setOpen(false)} title={title}>
        <NavLinks nav={nav} label={t("tabs")} onNavigate={() => setOpen(false)} />
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line px-3 pt-4">
          <span className="text-sm font-semibold text-muted">{appearance("title")}</span>
          <AppearanceMenu />
        </div>
      </SheetDialog>
    </>
  );
}
