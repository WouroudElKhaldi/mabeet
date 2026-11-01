import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AppearanceScript } from "@/components/theme/appearance-script";
import { isArabic } from "@/config/appearance";
import { BRAND } from "@/config/brand";
import { getSitePalette } from "@/modules/admin/server";
import "./globals.css";

// The fonts are files in this repository, so the build never depends on the internet. The Arabic fonts only hold
// Arabic letters: the browser takes English letters from the English font by itself (the stacks are in globals.css).
const inter = localFont({
  src: "./fonts/inter-100-900.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const archivo = localFont({
  src: "./fonts/archivo-100-900.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const plexArabic = localFont({
  src: [
    { path: "./fonts/plex-arabic-400.woff2", weight: "400" },
    { path: "./fonts/plex-arabic-500.woff2", weight: "500" },
    { path: "./fonts/plex-arabic-600.woff2", weight: "600" },
    { path: "./fonts/plex-arabic-700.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
});

const kufi = localFont({
  src: "./fonts/kufi-100-900.woff2",
  variable: "--font-kufi",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("footer");
  return {
    // Each page names itself; the brand follows in the tab ("Sign in · Mabeet").
    title: { default: `${BRAND.name} · ${BRAND.nameAr}`, template: `%s · ${BRAND.name}` },
    description: t("about"),
    applicationName: BRAND.name,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1512" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The palette is the admin's choice for the whole site; light or dark is the visitor's, applied before paint by
  // AppearanceScript so the page never flashes the wrong mode.
  const [locale, palette] = await Promise.all([getLocale(), getSitePalette()]);
  return (
    <html
      lang={locale}
      dir={isArabic(locale) ? "rtl" : "ltr"}
      data-palette={palette}
      // The boot script sets data-mode before React starts, so React must not treat it as a difference.
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} ${plexArabic.variable} ${kufi.variable}`}
    >
      <head>
        <AppearanceScript />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
