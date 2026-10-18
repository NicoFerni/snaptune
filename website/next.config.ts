import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain static HTML in out/, so it can be hosted anywhere (GitHub Pages, Vercel, Netlify).
  output: "export",
  images: { unoptimized: true },
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
