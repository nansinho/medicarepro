import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { serviceClient } from "@/lib/supabase/service";
import { timingSafeEqualString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { TAGS } from "@/lib/cms/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Cron : publication des articles programmés (status='scheduled'
   dont scheduled_for est passé). À planifier côté Coolify :
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://medicarepro.fr/api/cron/publish-scheduled   (toutes les 5 min)
   Idempotent — sans article mûr, ne fait rien.
   ============================================================ */

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !timingSafeEqualString(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = serviceClient();
  if (!service) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: due, error } = await service
    .from("posts")
    .update({ status: "published", published_at: now, scheduled_for: null })
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .select("id, slug, title");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (due && due.length > 0) {
    revalidateTag(TAGS.posts, "max");
    revalidateTag(TAGS.sitemap, "max");
    for (const post of due) revalidateTag(TAGS.post(post.slug), "max");
  }

  return NextResponse.json({ published: due?.length ?? 0 });
}

export { handle as GET, handle as POST };
