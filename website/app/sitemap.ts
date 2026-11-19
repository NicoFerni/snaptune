import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { homeUpdated, siteUrl } from "@/lib/seo";

// The dates are when each page's text changed, kept by hand: Google ignores lastmod once it learns
// that a site stamps every build as new.
const latestGuide = guides.map((g) => g.updated).sort().at(-1);

const url = (slug: string) => (slug ? `${siteUrl}/${slug}` : siteUrl);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // The Spanish guide is the home page's other language.
    { url: siteUrl, lastModified: homeUpdated, alternates: { languages: { en: siteUrl, es: url("es/autotune-gratis") } } },
    { url: `${siteUrl}/privacy`, lastModified: "2026-11-10" },
    { url: `${siteUrl}/terms`, lastModified: "2026-11-12" },
    { url: `${siteUrl}/guides`, lastModified: latestGuide },
    ...guides.map((g) => ({
      url: url(g.slug),
      lastModified: g.updated,
      // The English and Spanish versions of a page point at each other.
      ...(g.translation !== undefined && {
        alternates: { languages: { [g.lang ?? "en"]: url(g.slug), [g.lang === "es" ? "en" : "es"]: url(g.translation) } },
      }),
    })),
  ];
}
