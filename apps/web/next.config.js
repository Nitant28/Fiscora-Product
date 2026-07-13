import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  turbopack: {
    // Monorepo root — stops Next from picking C:\Users\Shubh\package-lock.json
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
