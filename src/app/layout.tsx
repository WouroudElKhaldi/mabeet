import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tafaddal",
  description: "Book Lebanese guesthouses directly with the people who run them.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
