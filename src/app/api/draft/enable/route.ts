import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getStaffUser } from "@/lib/admin/auth";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";

export const dynamic = "force-dynamic";

/* Active le mode aperçu (brouillons des pages) puis redirige vers la
   page demandée. Hors du matcher du proxy → la garde staff est ICI. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const path = request.nextUrl.searchParams.get("path") ?? "/";
  /* Seules les pages gérées sont prévisualisables. */
  const target = FALLBACK_PAGES[path] ? path : "/";

  const draft = await draftMode();
  draft.enable();
  return NextResponse.redirect(new URL(target, request.url));
}
