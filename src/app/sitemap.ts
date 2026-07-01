import type { MetadataRoute } from "next";

const BASE = "https://medicarepro.fr";

/** Routes publiques (vitrine) indexables, avec leur priorité SEO. */
const ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/fonctionnalites", priority: 0.8, changeFrequency: "monthly" },
  { path: "/bilans", priority: 0.8, changeFrequency: "monthly" },
  { path: "/securite", priority: 0.8, changeFrequency: "monthly" },
  { path: "/avantages", priority: 0.8, changeFrequency: "monthly" },
  { path: "/tarifs", priority: 0.8, changeFrequency: "monthly" },
  { path: "/a-propos", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
