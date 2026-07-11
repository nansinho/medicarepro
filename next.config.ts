import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : .next/standalone avec un server.js minimal et
  // uniquement les fichiers nécessaires (déploiement Docker léger).
  output: "standalone",
};

export default nextConfig;
