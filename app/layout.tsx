import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Next applies basePath to the manifest link and to /_next assets, but NOT to
// metadata icons — an unprefixed apple-touch-icon 404s and iOS falls back to a
// screenshot of the page as your Home Screen icon.
const base = process.env.PAGES_BASE_PATH ?? "";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LocalBeats",
  description: "Your offline music library",
  icons: { apple: `${base}/apple-icon.png` },
  // Next 16 no longer emits this (deprecated in favour of the manifest's
  // display member). Kept as belt-and-braces for standalone launch.
  other: { "apple-mobile-web-app-capable": "yes" },
  appleWebApp: {
    capable: true,
    title: "LocalBeats",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080b",
  // cover = draw under the notch/home indicator; safe-area insets handle the rest.
  viewportFit: "cover",
  // A player UI has no reflowable text worth pinch-zooming, and zoom makes
  // swipe-between-tracks misfire.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
