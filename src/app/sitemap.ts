import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/cms/seo";

/** Sitemap DB-driven : routes gérées (surcharges seo_meta + lastmod réels)
 *  + articles publiés. Fallback : les valeurs embarquées (SEO_DEFAULTS). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemapEntries();
}
