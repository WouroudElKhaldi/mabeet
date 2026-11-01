import type { Metadata } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "Mabeet",
  description: "Book Lebanese guesthouses directly with the people who run them.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${plexArabic.variable} ${kufi.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
