"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOutAndLeave } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("account");
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOutAndLeave()}>
      <LogOut className="size-4" aria-hidden />
      {t("signOut")}
    </Button>
  );
}
