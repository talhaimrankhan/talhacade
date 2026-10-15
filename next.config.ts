import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site — deploys to Vercel / Netlify as plain files (out/).
  output: "export",
  trailingSlash: true,
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
