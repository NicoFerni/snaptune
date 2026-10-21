import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// The admin panel and the ping endpoint aren't pages for anyone searching.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
