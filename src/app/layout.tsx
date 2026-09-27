import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  THEME_COLOR,
} from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// The move buttons are set in this and spell moves in Cyrillic (Г, Д, П…),
// so preload that subset too.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Icons (icon.ico, icon.svg, apple-icon.png) and the share image
// (opengraph-image.png) are files next to this layout; Next.js adds their
// tags. Regenerate them with scripts/generate-icons.sh.
export const metadata: Metadata = {
  // Just the origin: Next.js adds the base path to the icon and share-image
  // URLs itself, so a SITE_URL path here would appear twice. Page URLs below
  // are spelled out in full instead.
  metadataBase: new URL(SITE_URL.origin),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    locale: "bg_BG",
    url: absoluteUrl("/"),
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  // Added to the home screen, it opens full screen; the header and tab bar
  // already pad for the status bar and home indicator (safe-area insets).
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  // Move sequences are not phone numbers.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "dark",
  // Lay out under the notch / home indicator, so the `env(safe-area-inset-*)`
  // padding on the header and tab bar takes effect (it is 0 otherwise).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bg"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
