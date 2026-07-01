import type { MetadataRoute } from "next";

const BASE = "https://medicarepro.fr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Le back office admin n'a pas vocation à être indexé.
      disallow: ["/admin"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
