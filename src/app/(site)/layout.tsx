import type { ReactNode } from "react";
import { BackLink } from "@/components/shell/back-link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <BackLink className="mx-auto mt-4 flex w-fit max-w-360 px-4 sm:px-6 lg:px-10" />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
