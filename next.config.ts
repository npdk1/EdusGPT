import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pins the Turbopack workspace root to this folder (a stray lockfile in a
  // parent directory otherwise makes Next.js pick the user home directory).
  turbopack: { root: projectRoot },
  // msedge-tts uses class fields with initialisers (`_metadataOptions = new
  // MetadataOptions()`). Bundling it loses that initialiser, so every
  // setMetadata() call dies on `_metadataOptions.voiceLocale`. Keeping it an
  // external require preserves the class as written.
  serverExternalPackages: ["msedge-tts", "ws", "unpdf", "mammoth", "xlsx"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
