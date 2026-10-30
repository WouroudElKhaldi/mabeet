import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Strict defaults; inline styles are needed by the motion library and the theme boot script.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Google Maps embeds on place and experience pages.
  "frame-src https://maps.google.com https://www.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Uploaded photos live in Cloudflare R2, served from R2_PUBLIC_URL (a custom domain on the live site). The images
// config is fixed at build time, so the Docker build receives R2_PUBLIC_URL as a build argument.
const photoHost = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;

// The languages task wraps this with next-intl's plugin (createNextIntlPlugin("./src/i18n/request.ts")).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Loaded from node_modules, not bundled: its driver (pg) sits inside pnpm's nested folder, where only pg-boss
  // itself can find it.
  serverExternalPackages: ["pg-boss"],
  images: {
    remotePatterns: [
      // The demo data's stock pictures.
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(photoHost ? [{ protocol: "https" as const, hostname: photoHost }] : []),
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
