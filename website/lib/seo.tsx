import type { Release } from "@/lib/release";
import { links } from "@/lib/site";

// Structured data (schema.org JSON-LD) that tells search engines what SnapTune is: a free audio
// application, its systems, its download and its questions. No ratings or reviews: there aren't any
// to cite yet, and made-up ones would be a lie.

export const siteUrl = process.env.SITE_URL ?? "https://getsnaptune.com";

/** When the home page's text last changed, for the sitemap. */
export const homeUpdated = "2026-10-23";

export const keywords = [
  "free autotune",
  "free autotune plugin",
  "free autotune vst",
  "autotune fl studio free",
  "free pitcher alternative",
  "free pitch correction plugin",
  "free vocal tuner",
  "hard tune plugin",
  "real-time pitch correction",
  "autotune for mac free",
  "autotune for windows free",
  "autotune linux lv2",
  "open source autotune",
  "SnapTune",
];

// The link preview from app/opengraph-image.tsx. A page that sets its own `openGraph` or `twitter`
// replaces the layout's whole object, image included, so the guides pass this back in.
export const shareImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "SnapTune: free pitch correction plugin for Mac, Windows and Linux" };

// The site and who makes it, so search shows "SnapTune" and its logo rather than the bare domain.
export const webSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "SnapTune",
  url: siteUrl,
};

export const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SnapTune",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  email: "support@getsnaptune.com",
  founder: { "@type": "Person", name: "Nico Fernandez" },
  sameAs: [links.repo, links.x],
};

export const softwareApplication = (release: Release) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SnapTune",
  alternateName: "SnapTune free autotune plugin",
  description:
    "Free, open-source pitch correction (autotune) plugin for vocals: hard tune to natural, a 2.7 ms live mode, key and scale or MIDI target notes. VST3, Audio Unit and LV2.",
  url: siteUrl,
  applicationCategory: "MultimediaApplication",
  applicationSubCategory: "Audio plugin",
  operatingSystem: "macOS, Windows, Linux",
  softwareVersion: release.version,
  downloadUrl: links.releases,
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Nico Fernandez" },
  codeRepository: links.repo,
  sameAs: [links.repo, links.x],
  image: `${siteUrl}/screenshot.png`,
  screenshot: `${siteUrl}/screenshot.png`,
});

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** A JSON-LD script, with `<` escaped so no string in it can close the tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
