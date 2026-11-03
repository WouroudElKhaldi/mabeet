"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { signOutAndLeave } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("account");
  return (
    <Button variant="ghost" size="sm" className={slideParent} onClick={() => void signOutAndLeave()}>
      <SlideLabel icon={LogOut} flipInRtl>
        {t("signOut")}
      </SlideLabel>
    </Button>
  );
}
