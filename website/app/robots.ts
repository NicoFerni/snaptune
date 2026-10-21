import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// The admin panel and the ping endpoint aren't pages for anyone searching. AI search and assistant
// crawlers are welcome by name, so a blanket rule elsewhere never shuts them out: being cited when
// someone asks an assistant for a free autotune is part of how people find SnapTune.
const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/api/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: aiCrawlers, allow: "/", disallow },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
