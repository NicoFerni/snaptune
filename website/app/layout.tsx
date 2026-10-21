import type { Metadata, Viewport } from "next";
import { Literata, Rokkitt } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// The brand's two faces: Rokkitt capitals for display, Literata for reading (SIL OFL, also compiled
// into the plugin from ../Source/fonts).
const rokkitt = Rokkitt({ subsets: ["latin"], weight: "800", variable: "--font-rokkitt" });
const literata = Literata({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-literata" });

const description =
  "Free, open-source pitch correction plugin (VST3, Audio Unit and LV2) for Mac, Windows and Linux. Hard-tune your vocals, and hear it while you record with 2.7 ms of delay. Tested in FL Studio.";

// Absolute base for the link-preview image and URL. Set SITE_URL to host the site somewhere else.
const siteUrl = process.env.SITE_URL ?? "https://getsnaptune.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SnapTune: free pitch correction plugin for Mac, Windows and Linux",
  description,
  openGraph: {
    title: "SnapTune: free pitch correction plugin for Mac, Windows and Linux",
    description,
    url: "/",
    siteName: "SnapTune",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapTune: free pitch correction plugin for Mac, Windows and Linux",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#133621",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script adds `js` to <html> before React hydrates, hence the warning suppression.
    <html lang="en" className={`h-full antialiased ${rokkitt.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        {/* Entrance states only apply when scripting works (app/landing.css). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
