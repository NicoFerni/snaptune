import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // /free-autotune said what the home page says, so Google indexed the home page and left it out.
  async redirects() {
    return [{ source: "/free-autotune", destination: "/", permanent: true }];
  },
  // The admin mail form carries attachments (lib/mail-limits.ts); Vercel's own cap is 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
