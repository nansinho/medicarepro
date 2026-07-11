import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/* Désactive le mode aperçu et redirige (défaut : la page visitée). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const draft = await draftMode();
  draft.disable();
  const path = request.nextUrl.searchParams.get("path") ?? "/";
  return NextResponse.redirect(new URL(path.startsWith("/") ? path : "/", request.url));
}
