import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Static export: FreeSeak is 100% client-side, so the whole site
     builds into plain HTML/CSS/JS files in /out — perfect for
     Cloudflare Pages (build: npm run build, output: out). */
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
