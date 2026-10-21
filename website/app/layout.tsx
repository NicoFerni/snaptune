import type { Metadata, Viewport } from "next";
import { Literata, Rokkitt } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { keywords, siteUrl } from "@/lib/seo";
import "./globals.css";

// The brand's two faces: Rokkitt capitals for display, Literata for reading (SIL OFL, also compiled
// into the plugin from ../Source/fonts).
const rokkitt = Rokkitt({ subsets: ["latin"], weight: "800", variable: "--font-rokkitt" });
const literata = Literata({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-literata" });

// Written for search as much as for people: "free autotune" is what most people type when they
// want this. The trademark notice is in the footer of every page.
const title = "SnapTune: Free Autotune Plugin for FL Studio, Mac, Windows and Linux";
const description =
  "Free, open-source autotune (pitch correction) plugin for vocals. Hard tune to natural, 2.7 ms live mode. VST3, AU and LV2. A free Pitcher alternative for FL Studio.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords,
  applicationName: "SnapTune",
  authors: [{ name: "Nico Fernandez" }],
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "SnapTune",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
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
