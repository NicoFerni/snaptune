import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { homeUpdated, siteUrl } from "@/lib/seo";

// The dates are when each page's text changed, kept by hand: Google ignores lastmod once it learns
// that a site stamps every build as new.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: homeUpdated },
    ...guides.map((g) => ({ url: `${siteUrl}/${g.slug}`, lastModified: g.updated })),
  ];
}
