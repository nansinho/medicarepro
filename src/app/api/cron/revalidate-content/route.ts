import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqualString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { TAGS } from "@/lib/cms/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Purge du cache de contenu du site (pages gérées, menus,
   réglages, collections, articles, sitemap). À appeler après une
   mise à jour du contenu faite hors du back office (script de
   synchronisation, reprise de données) :
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     https://medicarepro.fr/api/cron/revalidate-content
   Idempotent, sans effet sur les données.
   ============================================================ */

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !timingSafeEqualString(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tags = [
    TAGS.pages,
    ...Object.keys(FALLBACK_PAGES).map((slug) => TAGS.page(slug)),
    TAGS.menus,
    TAGS.settings,
    TAGS.features,
    TAGS.faq,
    TAGS.pricing,
    TAGS.testimonials,
    TAGS.posts,
    TAGS.cities,
    TAGS.seo,
    TAGS.sitemap,
  ];
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags.length });
}

export { handle as GET, handle as POST };
