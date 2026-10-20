import type { NextConfig } from "next";

// GitHub Pages serves the site from a subpath (…/talhacade/); everything
// else (dev, Netlify, custom domains) stays at the root.
const isGitHubPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  // Fully static site — deploys to GitHub Pages / Vercel / Netlify as plain files (out/).
  output: "export",
  trailingSlash: true,
  ...(isGitHubPages
    ? { basePath: "/talhacade", assetPrefix: "/talhacade" }
    : {}),
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
