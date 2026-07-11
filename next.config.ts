import type { NextConfig } from "next";

/* Hôte Supabase (Storage public) autorisé pour next/image. */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Sortie autonome : .next/standalone avec un server.js minimal et
  // uniquement les fichiers nécessaires (déploiement Docker léger).
  output: "standalone",
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  experimental: {
    serverActions: {
      // Upload de médias via server action (défaut 1 Mo trop bas).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
