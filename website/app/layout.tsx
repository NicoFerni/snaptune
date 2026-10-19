import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const description =
  "Free, open-source pitch correction plugin (VST3 and Audio Unit) for Mac and Windows. Hard-tune your vocals, and hear it while you record with 2.7 ms of delay. Tested in FL Studio.";

// Absolute base for the Open Graph image. Vercel sets VERCEL_PROJECT_PRODUCTION_URL; elsewhere set SITE_URL.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SnapTune: free pitch correction plugin for Mac and Windows (VST3, AU)",
  description,
  openGraph: {
    title: "SnapTune: free pitch correction plugin for Mac and Windows",
    description,
    images: [{ url: "/screenshot.png", width: 1600, height: 1024, alt: "The SnapTune plugin window" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapTune: free pitch correction plugin for Mac and Windows",
    description,
    images: ["/screenshot.png"],
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
