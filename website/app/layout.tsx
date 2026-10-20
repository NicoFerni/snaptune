import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const description =
  "Free, open-source pitch correction plugin (VST3 and Audio Unit) for Mac and Windows. Hard-tune your vocals, and hear it while you record with 2.7 ms of delay. Tested in FL Studio.";

// Absolute base for the link-preview image and URL. Set SITE_URL to host the site somewhere else.
const siteUrl = process.env.SITE_URL ?? "https://getsnaptune.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SnapTune: free pitch correction plugin for Mac and Windows (VST3, AU)",
  description,
  openGraph: {
    title: "SnapTune: free pitch correction plugin for Mac and Windows",
    description,
    url: "/",
    siteName: "SnapTune",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapTune: free pitch correction plugin for Mac and Windows",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
