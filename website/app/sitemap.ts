import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { homeUpdated, siteUrl } from "@/lib/seo";

// The dates are when each page's text changed, kept by hand: Google ignores lastmod once it learns
// that a site stamps every build as new.
const latestGuide = guides.map((g) => g.updated).sort().at(-1);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: homeUpdated },
    { url: `${siteUrl}/privacy`, lastModified: "2026-11-10" },
    { url: `${siteUrl}/guides`, lastModified: latestGuide },
    ...guides.map((g) => ({
      url: `${siteUrl}/${g.slug}`,
      lastModified: g.updated,
      // The English and Spanish versions of a page point at each other.
      ...(g.translation && {
        alternates: { languages: { [g.lang ?? "en"]: `${siteUrl}/${g.slug}`, [g.lang === "es" ? "en" : "es"]: `${siteUrl}/${g.translation}` } },
      }),
    })),
  ];
}
